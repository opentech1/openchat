"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "@/lib/auth-client";
import { useChat } from "@ai-sdk-tools/store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import ChatComposer from "@/components/chat-composer";
import ChatMessagesFeed from "@/components/chat-messages-feed";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { useModelSelection } from "@/hooks/use-model-selection";
import { useJonMode } from "@/hooks/use-jon-mode";
import { useProgressiveWaitDetection } from "@/hooks/use-progressive-wait-detection";
import { useStreamSubscription } from "@/hooks/use-stream-subscription";
import { useChatSession } from "@/hooks/use-chat-session";
import { OpenRouterLinkModalLazy as OpenRouterLinkModal } from "@/components/lazy/openrouter-link-modal-lazy";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  captureClientEvent,
  identifyClient,
  registerClientProperties,
} from "@/lib/posthog";
import { LiveRegion } from "@/components/ui/live-region";
import { ChatSkeleton } from "@/components/skeletons/chat-skeleton";
import { logError } from "@/lib/logger";
import type { ReasoningConfig } from "@/lib/reasoning-config";
import { isApiError } from "@/lib/error-handling";
import { toConvexChatId } from "@/lib/type-converters";
import { SESSION_STORAGE_KEYS } from "@/config/storage-keys";
import { getMessageThrottle } from "@/config/constants";
import { useConvexUser } from "@/contexts/convex-user-context";

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    reasoning?: string;
    createdAt: string | Date;
    attachments?: Array<{
      storageId: string;
      filename: string;
      contentType: string;
      size: number;
      uploadedAt: number;
    }>;
  }>;
  // STREAM RECONNECTION: Initial stream ID to reconnect to on reload
  initialStreamId?: string | null;
};

const MESSAGE_THROTTLE_MS = getMessageThrottle();

function ChatRoom({ chatId, initialMessages, initialStreamId }: ChatRoomProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const workspaceId = user?.id ?? null;

  // Get Convex user from shared context
  const { convexUser, isLoading: convexUserLoading } = useConvexUser();
  const convexUserId = convexUser?._id ?? null;

  // ============================================================================
  // MESSAGES LOADING: Fetch messages from Convex using useChatSession
  // This is the PRIMARY source of messages - initialMessages is just for SSR
  // ============================================================================
  const { messages: convexMessages, isLoading: messagesLoading, isSkipped: messagesSkipped } = useChatSession({
    chatId,
    userId: convexUserId,
  });

  // DEBUG: Log useChatSession state
  console.log("[MESSAGES] useChatSession state", {
    chatId,
    convexUserId,
    messagesLoading,
    messagesSkipped,
    convexMessagesCount: convexMessages?.length ?? "null",
    hasMessages: Boolean(convexMessages && convexMessages.length > 0),
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  // Use the OpenRouter key hook for key management
  const {
    apiKey,
    isLoading: keyLoading,
    error: _keyError,
    saveKey,
    removeKey,
  } = useOpenRouterKey();

  // Jon Mode: Get em-dash prevention setting
  const { jonMode } = useJonMode();

  // ============================================================================
  // Model Selection Hook (replaces openRouterReducer)
  // This hook handles: model fetching, caching, localStorage persistence
  // ============================================================================
  const {
    models: modelOptions,
    selectedModel: selectedModelFromHook,
    selectedModelId: selectedModel,
    isLoading: modelsLoading,
    error: modelsErrorObj,
    setSelectedModelId,
    refreshModels,
  } = useModelSelection({
    apiKey: apiKey ?? undefined,
    onInvalidApiKey: removeKey,
  });

  // Convert error object to string for display
  const modelsError = modelsErrorObj?.message ?? null;

  // UI-only state for modal and API key saving
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [keyPromptDismissed, setKeyPromptDismissed] = useState(true);

  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  const autoSendAttemptedRef = useRef(false);

  // Streaming state - use local state for immediate updates, query for reconnection detection
  const [activeStreamId, setActiveStreamId] = useState<string | null>(initialStreamId ?? null);
  const [isConvexStreaming, setIsConvexStreaming] = useState(Boolean(initialStreamId));

  // Redis SSE streaming state - for faster, T3Chat-style token delivery
  const [redisStreamId, setRedisStreamId] = useState<string | null>(null);

  console.log("[STREAM] State snapshot", { chatId, convexUserId, activeStreamId, isConvexStreaming });
  const prepareChat = useMutation(api.streaming.prepareChat);

  // STREAM RECONNECTION: Query to detect active streams on reload
  const activeStreamFromDb = useQuery(
    api.messages.getActiveStream,
    convexUserId && chatId
      ? { chatId: toConvexChatId(chatId), userId: convexUserId }
      : "skip"
  );

  // Auto-reconnect to active stream from database (for page reload scenario)
  const hasAttemptedReconnect = useRef(false);
  useEffect(() => {
    // Only attempt reconnection once, when query first resolves
    if (hasAttemptedReconnect.current) return;
    if (activeStreamFromDb === undefined) return; // Query still loading
    if (!activeStreamFromDb) return; // No active stream in DB
    if (activeStreamId) return; // Already have an active stream locally

    // Found an active stream from database - reconnect!
    hasAttemptedReconnect.current = true;
    setActiveStreamId(activeStreamFromDb);
    setIsConvexStreaming(true);
  }, [activeStreamFromDb, activeStreamId]);

  // STREAM RECONNECTION FIX: Sync activeStreamId from initialStreamId prop when it changes
  // This handles the case where ChatRoomWrapper fetches messages AFTER ChatRoom mounts
  // and discovers a streaming message. useState(initialValue) only uses the value on
  // first render, so we need this effect to sync prop changes to state.
  useEffect(() => {
    if (initialStreamId && !activeStreamId) {
      setActiveStreamId(initialStreamId);
      setIsConvexStreaming(true);
    }
  }, [initialStreamId, activeStreamId]);

  // Track which stream IDs were created by THIS browser session
  const drivenStreamIdsRef = useRef<Set<string>>(new Set());

  // Check for pending message and model from dashboard on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_MESSAGE);
    if (pending) {
      setPendingMessage(pending);
      setShouldAutoSend(true);
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_MESSAGE);
    }
    const pendingModel = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_MODEL);
    if (pendingModel) {
      // Use the hook's setSelectedModelId which handles localStorage persistence
      setSelectedModelId(pendingModel);
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_MODEL);
    }
  }, [setSelectedModelId]);

  // Combined initialization effect for workspace and API key telemetry
  useEffect(() => {
    if (!workspaceId) return;
    identifyClient(workspaceId, {
      workspaceId,
      properties: { auth_state: "member" },
    });
    registerClientProperties({
      auth_state: "member",
      workspace_id: workspaceId,
      has_openrouter_key: Boolean(apiKey),
    });
  }, [workspaceId, apiKey]);

  // Clean up openrouter query param from URL if present
  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    if (params.has("openrouter")) {
      params.delete("openrouter");
      const query = params.toString();
      type ReplaceArg = Parameters<typeof router.replace>[0];
      const replaceTarget = query
        ? ({
            pathname,
            query: Object.fromEntries(params.entries()),
          } as unknown as ReplaceArg)
        : (pathname as unknown as ReplaceArg);
      router.replace(replaceTarget);
    }
  }, [pathname, router, searchParamsString]);

  // Open the key modal when API key becomes available (user just added it)
  useEffect(() => {
    if (!apiKey) return;
    setKeyPromptDismissed(false);
  }, [apiKey]);

  // Handler for saving API key from modal
  const handleSaveApiKey = useCallback(
    async (key: string) => {
      setApiKeyError(null);
      setSavingApiKey(true);
      try {
        await saveKey(key);
        setKeyPromptDismissed(false);
        registerClientProperties({ has_openrouter_key: true });
        captureClientEvent("openrouter.key_saved", {
          source: "modal",
          masked_tail: key.slice(-4),
          scope: "workspace",
        });
        // useModelSelection will automatically fetch models when apiKey changes
        await refreshModels();
      } catch (error: unknown) {
        logError("Failed to save OpenRouter API key", error);
        setApiKeyError(
          error instanceof Error && error.message
            ? error.message
            : "Failed to save OpenRouter API key."
        );
      } finally {
        setSavingApiKey(false);
      }
    },
    [saveKey, refreshModels],
  );

  const normalizedInitial = useMemo(
    () => initialMessages.map(normalizeMessage),
    [initialMessages],
  );

  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(320);

  const handleMissingRequirement = useCallback((reason: "apiKey" | "model") => {
    if (reason === "apiKey") {
      // Show toast with action to add OpenRouter key
      toast.error("Add your OpenRouter API key to use AI models", {
        duration: 6000,
        action: {
          label: "Add key",
          onClick: () => {
            // Open the modal to add key
            setKeyPromptDismissed(false);
          },
        },
      });
    } else {
      toast.error("Select an OpenRouter model to continue.");
    }
  }, []);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
        body: { chatId },
      }),
    [chatId],
  );

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: chatId,
    messages: normalizedInitial.map(toUiMessage),
    transport: chatTransport,
    experimental_throttle:
      Number.isFinite(MESSAGE_THROTTLE_MS) && MESSAGE_THROTTLE_MS > 0
        ? MESSAGE_THROTTLE_MS
        : undefined,
    onFinish: async ({ message, isAbort, isError }) => {
      if (isAbort || isError) return;
      const assistantCreatedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? {
                ...item,
                metadata: { ...item.metadata, createdAt: assistantCreatedAt },
              }
            : item,
        ),
      );
    },
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message === "OpenRouter API key missing") {
          handleMissingRequirement("apiKey");
          return;
        }
        if (error.message === "OpenRouter model not selected") {
          handleMissingRequirement("model");
          return;
        }

        // Handle provider overload/rate limit errors
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes("provider returned error") ||
          errorMessage.includes("failed after") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("too many requests") ||
          errorMessage.includes("overloaded") ||
          errorMessage.includes("high load")
        ) {
          toast.error("AI Provider Overloaded", {
            description: "The model provider is experiencing high load. Try again in a moment.",
            action: {
              label: "Retry",
              onClick: () => {
                // Get the last user message and resend it
                const lastUserMessage = messages.filter(m => m.role === "user").pop();
                if (lastUserMessage) {
                  const textContent = lastUserMessage.parts
                    .filter((p): p is { type: "text"; text: string } => p.type === "text")
                    .map(p => p.text)
                    .join("");
                  if (textContent && selectedModel) {
                    void sendMessage(
                      {
                        id: crypto.randomUUID(),
                        role: "user",
                        parts: [{ type: "text", text: textContent }],
                        metadata: { createdAt: new Date().toISOString() },
                      },
                      {
                        body: {
                          chatId,
                          modelId: selectedModel,
                        },
                      }
                    );
                  }
                }
              },
            },
            duration: 10000, // Show for 10 seconds
          });
          return;
        }

        // Handle generic errors with more helpful message
        if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
          toast.error("Connection Error", {
            description: "Unable to reach the AI service. Check your connection and try again.",
            duration: 5000,
          });
          return;
        }
      }

      // Fallback for unknown errors
      toast.error("Something went wrong", {
        description: "Failed to get a response from the AI. Please try again.",
        duration: 5000,
      });
      logError("Chat stream error", error);
    },
  });

  // Redis SSE streaming for faster token delivery (T3Chat-style)
  // This subscribes to a Redis stream and updates messages in real-time
  const { status: sseStatus } = useStreamSubscription({
    streamId: redisStreamId,
    onToken: useCallback((token: string) => {
      // Accumulate tokens and update the last assistant message
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "assistant") {
          const currentText = lastMsg.parts.find((p): p is { type: "text"; text: string } => p.type === "text")?.text || "";
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, parts: [{ type: "text" as const, text: currentText + token }] }
          ];
        }
        return prev;
      });
    }, []),  // setMessages from useChat is stable
    onComplete: useCallback(() => {
      console.log("[SSE] Stream complete");
      setRedisStreamId(null);
    }, []),
    onError: useCallback((error: Error) => {
      console.error("[SSE] Error", error);
      setRedisStreamId(null);
    }, []),
    autoReconnect: true,
  });

  // Convex query for stream body - provides reliable token display
  // This is now the PRIMARY method for displaying tokens (simpler than Redis SSE)
  console.log("[STREAM] Convex query check", { activeStreamId, isConvexStreaming });
  const streamBody = useQuery(
    api.streaming.getStreamBody,
    activeStreamId ? { streamId: activeStreamId as any } : "skip"
  );
  const streamText = streamBody?.text || "";
  const streamHookStatus = streamBody?.status as "pending" | "streaming" | "done" | "error" | "timeout" | undefined;

  useLayoutEffect(() => {
    const wrapper = composerRef.current;
    if (
      !wrapper ||
      typeof window === "undefined" ||
      !("ResizeObserver" in window)
    ) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const blockSize =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        setComposerHeight(blockSize);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // ============================================================================
  // MESSAGES SYNC: Sync Convex messages to useChat UI state
  // This is the PRIMARY sync mechanism - Convex queries are the source of truth
  // Only sync on initial load (when useChat has 0 messages and Convex has messages)
  // This prevents overwriting optimistic messages during normal operation
  // ============================================================================
  const hasInitializedMessagesRef = useRef(false);
  useEffect(() => {
    // DEBUG: Log sync effect execution
    console.log("[MESSAGES] Sync effect running", {
      hasInitialized: hasInitializedMessagesRef.current,
      messagesLoading,
      messagesSkipped,
      convexMessagesCount: convexMessages?.length ?? "null",
      currentUiMessagesCount: messages.length,
    });

    // Skip if already initialized or still loading
    if (hasInitializedMessagesRef.current) {
      console.log("[MESSAGES] Sync skipped: already initialized");
      return;
    }
    if (messagesLoading) {
      console.log("[MESSAGES] Sync skipped: still loading");
      return;
    }
    if (!convexMessages || convexMessages.length === 0) {
      console.log("[MESSAGES] Sync skipped: no messages", { convexMessages, messagesSkipped });
      return;
    }

    // Only sync once on initial load
    hasInitializedMessagesRef.current = true;

    // Convert Convex messages to UI format
    const uiMessages = convexMessages.map(toUiMessage);
    console.log("[MESSAGES] ✅ Syncing from Convex", { count: uiMessages.length, firstMessage: uiMessages[0] });
    setMessages(uiMessages);
  }, [convexMessages, messagesLoading, messagesSkipped, messages.length, setMessages]);

  // Legacy sync for SSR initialMessages (fallback if Convex query fails)
  const initialMessageCountRef = useRef(initialMessages.length);
  useEffect(() => {
    // Skip if Convex messages already loaded
    if (hasInitializedMessagesRef.current) return;
    // Only sync if we went from 0 to N messages (initial load completed)
    // This prevents overwriting optimistic messages during normal operation
    if (initialMessageCountRef.current === 0 && initialMessages.length > 0) {
      const uiMessages = normalizedInitial.map(toUiMessage);
      setMessages(uiMessages);
      hasInitializedMessagesRef.current = true;
    }
    initialMessageCountRef.current = initialMessages.length;
  }, [initialMessages.length, normalizedInitial, setMessages]);

  const handleSend = useCallback(
    async ({
      text,
      modelId,
      apiKey: requestApiKey,
      attachments,
      reasoningConfig,
      jonMode: jonModeParam,
    }: {
      text: string;
      modelId: string;
      apiKey: string;
      attachments?: Array<{
        storageId: string;
        filename: string;
        contentType: string;
        size: number;
        url?: string;
      }>;
      reasoningConfig?: ReasoningConfig;
      jonMode?: boolean;
    }) => {
      // DEBUG: Entry point logging
      console.log("[STREAM] ===== handleSend ENTRY =====");
      console.log("[STREAM] Input:", { textLength: text.length, textPreview: text.slice(0, 50), modelId, hasApiKey: Boolean(requestApiKey) });
      console.log("[STREAM] Auth state:", { workspaceId, convexUserId, convexUserLoading });
      console.log("[STREAM] Env:", {
        hasConvexSiteUrl: Boolean(process.env.NEXT_PUBLIC_CONVEX_SITE_URL),
        convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL
      });

      const content = text.trim();
      if (!content) return;
      if (!modelId) {
        handleMissingRequirement("model");
        return;
      }
      if (!requestApiKey) {
        handleMissingRequirement("apiKey");
        return;
      }

      console.log("[STREAM] handleSend started", { chatId, convexUserId, modelId, contentLength: content.length });

      // Use Convex persistent streaming for true stream persistence
      // This ensures the stream continues even if the user closes the tab
      if (convexUserId) {
        try {
          const userMessageId = crypto.randomUUID?.() ?? `user-${Date.now()}`;
          const assistantMessageId = crypto.randomUUID?.() ?? `assistant-${Date.now()}`;
          const createdAt = new Date().toISOString();

          // 1. Create user message, stream, and assistant placeholder in Convex
          console.log("[STREAM] Calling prepareChat...", { chatId, userId: convexUserId });
          const result = await prepareChat({
            chatId: toConvexChatId(chatId),
            userId: convexUserId,
            userContent: content,
            userMessageId,
            assistantMessageId,
          });
          console.log("[STREAM] prepareChat result", { result, streamId: result?.streamId, assistantMessageId: result?.assistantMessageId });

          // 2. Add messages to local UI immediately for instant feedback
          setMessages((prev) => [
            ...prev,
            {
              id: userMessageId,
              role: "user" as const,
              parts: [{ type: "text" as const, text: content }],
              metadata: { createdAt },
            },
            {
              id: assistantMessageId,
              role: "assistant" as const,
              parts: [{ type: "text" as const, text: "" }],
              metadata: { createdAt: new Date().toISOString() },
            },
          ]);

          // 3. Set active stream state and track as driven (created in THIS session)
          // This triggers the Convex stream body query to start fetching content
          setActiveStreamId(result.streamId as string);
          setIsConvexStreaming(true);
          drivenStreamIdsRef.current.add(result.streamId as string);

          // 4. Build conversation history for the LLM
          const conversationMessages = messages.map((m) => {
            const textContent = m.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("");
            return { role: m.role, content: textContent };
          });
          conversationMessages.push({ role: "user", content });

          // 5. Start the stream on Convex (fire and forget - continues even if we disconnect)
          const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
          console.log("[STREAM] convexSiteUrl", { convexSiteUrl, hasUrl: Boolean(convexSiteUrl) });
          if (convexSiteUrl) {
            const streamUrl = `${convexSiteUrl}/stream-llm`;
            console.log("[STREAM] Starting fetch to /stream-llm", { streamUrl, streamId: result.streamId, messageId: result.assistantMessageId });
            // Fire and forget - the server will stream to Convex, and our query will pick it up
            // Don't await or drain the response - let the Convex query handle displaying tokens
            // Clear any previous Redis stream before starting new one
            setRedisStreamId(null);

            fetch(streamUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                streamId: result.streamId,
                messageId: result.assistantMessageId,
                apiKey: requestApiKey,
                modelId,
                messages: conversationMessages,
                reasoningConfig,
              }),
            })
              .then((response) => {
                console.log("[STREAM] Received response", {
                  status: response.status,
                  statusText: response.statusText,
                  ok: response.ok
                });

                // Capture X-Stream-Id header for Redis SSE streaming
                const headerStreamId = response.headers.get("X-Stream-Id");
                if (headerStreamId) {
                  console.log("[STREAM] Got Redis stream ID", { headerStreamId });
                  setRedisStreamId(headerStreamId);
                }

                // Drain response body to allow connection to complete properly
                if (response.body) {
                  const reader = response.body.getReader();
                  (async () => {
                    while (true) {
                      const { done } = await reader.read();
                      if (done) break;
                    }
                  })();
                }
              })
              .catch((err) => {
                console.log("[STREAM] Fetch error", { error: err?.message || err, stack: err?.stack });
                logError("Failed to start stream", err);
                // Clear streaming state and driven stream tracking on error
                setActiveStreamId(null);
                setIsConvexStreaming(false);
                setRedisStreamId(null);
                drivenStreamIdsRef.current.delete(result.streamId as string);
                // Remove the placeholder assistant message
                setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
                toast.error("Failed to connect to AI service", {
                  description: "Check your connection and try again.",
                  duration: 5000,
                });
              });
          } else {
            // No Convex site URL configured - this is a configuration error
            logError("NEXT_PUBLIC_CONVEX_SITE_URL not configured", new Error("Missing env var"));
            setActiveStreamId(null);
            setIsConvexStreaming(false);
            setRedisStreamId(null);
            drivenStreamIdsRef.current.delete(result.streamId as string);
            setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
            toast.error("AI service not configured", {
              description: "Please check your environment configuration.",
              duration: 5000,
            });
          }

          captureClientEvent("chat_message_submitted", {
            chat_id: chatId,
            model_id: modelId,
            characters: content.length,
            has_api_key: Boolean(requestApiKey),
            has_attachments: Boolean(attachments && attachments.length > 0),
            attachment_count: attachments?.length || 0,
            persistent_streaming: true,
          });
        } catch (error: unknown) {
          logError("Failed to prepare chat", error);
          // Clear streaming state on error
          setActiveStreamId(null);
          setIsConvexStreaming(false);
          setRedisStreamId(null);
          toast.error("Failed to send message");
          throw error;
        }
      } else {
        // Fallback to original flow if Convex user not available
        const id = crypto.randomUUID?.() ?? `${Date.now()}`;
        const createdAt = new Date().toISOString();
        try {
          await sendMessage(
            {
              id,
              role: "user",
              parts: [{ type: "text", text: content }],
              metadata: {
                createdAt,
              },
            },
            {
              body: {
                chatId,
                modelId,
                apiKey: requestApiKey,
                attachments,
                reasoningConfig,
                jonMode: jonModeParam,
              },
            },
          );
          captureClientEvent("chat_message_submitted", {
            chat_id: chatId,
            model_id: modelId,
            characters: content.length,
            has_api_key: Boolean(requestApiKey),
            has_attachments: Boolean(attachments && attachments.length > 0),
            attachment_count: attachments?.length || 0,
          });
        } catch (error: unknown) {
          let status: number | null = null;

          if (error instanceof Response) {
            status = error.status;
          } else if (isApiError(error) && typeof error.status === "number") {
            status = error.status;
          } else if (
            isApiError(error) &&
            error.cause &&
            typeof error.cause === "object" &&
            "status" in error.cause &&
            typeof error.cause.status === "number"
          ) {
            status = error.cause.status;
          }
          if (status === 429) {
            captureClientEvent("chat.rate_limited", {
              chat_id: chatId,
            });
          } else if (status === 401) {
            // removeKey triggers useModelSelection to clear models via onInvalidApiKey callback
            await removeKey();
            toast.error("OpenRouter API key invalid", {
              description:
                "We cleared the saved key. Add a valid key to keep chatting.",
            });
            return;
          }
          logError("Failed to send message", error);
          throw error;
        }
      }
    },
    [chatId, convexUserId, prepareChat, messages, setMessages, sendMessage, handleMissingRequirement, removeKey],
  );

  // Update assistant message content using Convex stream body query
  // This is the PRIMARY method for displaying streaming tokens (simpler than Redis SSE)
  useEffect(() => {
    if (!activeStreamId) return;

    // Find and update the last assistant message with stream content
    if (streamText) {
      setMessages((prev) => {
        // Use findLastIndex to get the last assistant message
        const lastAssistantIdx = prev.findLastIndex((m) => m.role === "assistant");
        if (lastAssistantIdx === -1) return prev;

        const msg = prev[lastAssistantIdx];
        // Only update if content actually changed to avoid unnecessary re-renders
        const currentText = msg?.parts.find((p): p is { type: "text"; text: string } => p.type === "text")?.text || "";
        if (currentText === streamText) return prev;

        const updated = [...prev];
        if (msg) {
          updated[lastAssistantIdx] = {
            ...msg,
            parts: [{ type: "text" as const, text: streamText }],
          };
        }
        return updated;
      });
    }

    // Clear stream state when completed, error, or timeout
    // This is CRITICAL - without it, isConvexStreaming stays true forever
    if (streamHookStatus === "done" || streamHookStatus === "error" || streamHookStatus === "timeout") {
      drivenStreamIdsRef.current.delete(activeStreamId);
      // Reset streaming state so UI no longer shows loading indicators
      setActiveStreamId(null);
      setIsConvexStreaming(false);
      setRedisStreamId(null);

      if (streamHookStatus === "error" || streamHookStatus === "timeout") {
        toast.error(streamHookStatus === "timeout" ? "Response timed out" : "Failed to get response", {
          description: "Please try sending your message again.",
          duration: 5000,
        });
      }
    }
  }, [activeStreamId, streamText, streamHookStatus, setMessages]);

  // Model selection handler - uses hook's setSelectedModelId for persistence
  const handleModelSelection = useCallback(
    (next: string) => {
      setSelectedModelId(next);
    },
    [setSelectedModelId],
  );

  // Auto-send pending message from dashboard
  useEffect(() => {
    if (!shouldAutoSend || autoSendAttemptedRef.current) return;
    if (!pendingMessage || !selectedModel || !apiKey) return;
    if (status !== "ready") return;

    autoSendAttemptedRef.current = true;
    setShouldAutoSend(false);

    // Auto-send the message
    void handleSend({
      text: pendingMessage,
      modelId: selectedModel,
      apiKey: apiKey,
      jonMode: jonMode,
    });
  }, [shouldAutoSend, pendingMessage, selectedModel, apiKey, jonMode, status, handleSend]);

  // Combine AI SDK status with Convex streaming status
  const isStreaming = status === "streaming" || isConvexStreaming;
  const isSubmitting = status === "submitted";
  const _busy = isSubmitting || isStreaming;

  // Progressive wait detection for better loading states
  const { waitState, elapsedSeconds } = useProgressiveWaitDetection(isSubmitting || isStreaming);
  const isLinked = Boolean(apiKey);
  // Only show modal when user explicitly wants to add key (via toast action or settings)
  // Now keyLoading replaces the old checkedApiKey - once key hook finishes loading, we can show modal
  const showKeyModal = !keyPromptDismissed && !keyLoading && !isLinked;
  // Don't disable composer - let users type even without key
  const composerDisabled = false;
  // Don't disable send button when streaming - user needs to be able to click stop
  // Also don't block sending without API key - let handleSend show the toast instead
  const sendDisabled = isSubmitting || modelsLoading || !selectedModel;

  // Calculate padding to ensure messages don't get hidden behind the fixed composer
  // composerHeight + some breathing room (32px) but with a sensible minimum
  const conversationPaddingBottom = Math.max(composerHeight + 32, 180);

  // ============================================================================
  // Consolidated Loading State
  // Single derived state replaces 7+ individual loading booleans
  // ============================================================================
  const chatState = useMemo(() => {
    // DEBUG: Log loading state calculation
    console.log("[LOADING] chatState check", {
      workspaceId,
      keyLoading,
      modelsLoading,
      convexUserLoading,
      convexUserId,
      messagesLoading,
      messagesSkipped,
    });

    // No workspace = still authenticating
    if (!workspaceId) return "loading" as const;
    // API key still loading from hook = loading
    if (keyLoading) return "loading" as const;
    // Models still loading = loading
    if (modelsLoading) return "loading" as const;
    // Convex user still loading = loading (prevents null convexUserId on send)
    if (convexUserLoading) return "loading" as const;
    // Convex user not available (not found/not authenticated) - keep loading
    // This prevents showing empty chat when user is still resolving
    if (!convexUserId) return "loading" as const;
    // Messages still loading from Convex = loading
    // This ensures we don't show an empty chat when messages exist in the database
    if (messagesLoading) return "loading" as const;
    // Ready to use
    return "ready" as const;
  }, [workspaceId, keyLoading, modelsLoading, convexUserLoading, convexUserId, messagesLoading, messagesSkipped]);

  // Show skeleton during initial load
  if (chatState === "loading") {
    return <ChatSkeleton messageCount={4} showComposer />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-4 focus:outline-none focus-visible:outline-none">
      {/* Screen reader announcements for loading states */}
      <LiveRegion
        message={isSubmitting ? "Sending message..." : isStreaming ? "Receiving response..." : ""}
        politeness="polite"
      />
      <OpenRouterLinkModal
        open={showKeyModal}
        saving={savingApiKey || modelsLoading}
        errorMessage={apiKeyError ?? modelsError}
        onSubmit={handleSaveApiKey}
        onTroubleshoot={() => {
          setApiKeyError(null);
          if (apiKey) void refreshModels();
        }}
        onClose={() => {
          setKeyPromptDismissed(true);
        }}
        hasApiKey={Boolean(apiKey)}
      />
      <ChatMessagesFeed
        initialMessages={normalizedInitial}
        optimisticMessages={messages}
        paddingBottom={conversationPaddingBottom}
        className="flex-1 rounded-xl bg-background/40 shadow-inner"
        isStreaming={isStreaming}
        isSubmitted={isSubmitting}
        userId={convexUserId as string | null}
        chatId={chatId}
        waitState={waitState}
        elapsedSeconds={elapsedSeconds}
        selectedModelName={selectedModelFromHook?.label}
      />

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-30 flex justify-center transition-all duration-200 ease-in-out md:left-[calc(var(--sb-width)+1rem)] md:right-4">
        <div ref={composerRef} className="pointer-events-auto w-full max-w-3xl">
          <ErrorBoundary level="section" resetKeys={[chatId]}>
            <ChatComposer
              placeholder="Type your message..."
              sendDisabled={sendDisabled}
              disabled={composerDisabled}
              onSend={handleSend}
              modelOptions={modelOptions ?? []}
              modelValue={selectedModel}
              onModelChange={handleModelSelection}
              modelsLoading={modelsLoading}
              apiKey={apiKey}
              isStreaming={isStreaming}
              onStop={() => {
                // Stop AI SDK stream (Convex stream continues and completes on server)
                // The activeStreamId will automatically update when stream completes
                stop();
              }}
              onMissingRequirement={handleMissingRequirement}
              userId={convexUserId}
              chatId={toConvexChatId(chatId)}
              messages={messages}
              jonMode={jonMode}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

ChatRoom.displayName = "ChatRoom";

export default React.memo(ChatRoom);
