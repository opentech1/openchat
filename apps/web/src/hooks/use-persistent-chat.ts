/**
 * usePersistentChat - Wrapper around AI SDK's useChat with Convex persistence
 *
 * Features:
 * - Creates new chat on first message (when chatId is undefined)
 * - Loads existing messages from Convex
 * - Saves messages to Convex on completion
 * - Supports navigation to chat page after creation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useQuery, useMutation } from "convex/react";
import { convexClient } from "@/lib/convex";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-client";
import { useModelStore } from "@/stores/model";
import { useOpenRouterKey } from "@/stores/openrouter";
import { useProviderStore, calculateCost } from "@/stores/provider";
import { usePendingMessageStore } from "@/stores/pending-message";
import { toast } from "sonner";

export interface UsePersistentChatOptions {
  chatId?: string;
  onChatCreated?: (chatId: string) => void;
}

export interface UsePersistentChatReturn {
  messages: UIMessage[];
  sendMessage: (message: { text: string; files?: any[] }) => Promise<void>;
  status: "ready" | "submitted" | "streaming" | "error";
  error: Error | undefined;
  stop: () => void;
  isNewChat: boolean;
  isLoadingMessages: boolean;
  chatId: string | null;
}

// Error metadata type (matches Convex schema)
interface MessageError {
  code: string;
  message: string;
  details?: string;
  provider?: string;
  retryable?: boolean;
}

// DEPRECATED: Tool invocation type from Convex (legacy format)
interface ToolInvocation {
  toolName: string;
  toolCallId: string;
  state: string; // "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

// NEW: Chain of thought part type - preserves exact stream order
interface ChainOfThoughtPart {
  type: "reasoning" | "tool";
  index: number; // Original position in the AI stream
  // For reasoning parts
  text?: string;
  // For tool parts
  toolName?: string;
  toolCallId?: string;
  state?: string; // "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

// Convert Convex message to AI SDK UIMessage format
// Supports both new chainOfThoughtParts format and legacy reasoning/toolInvocations
function convexMessageToUIMessage(msg: {
  _id: string;
  role: string;
  content: string;
  // DEPRECATED: Legacy fields
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
  // NEW: Unified chain of thought parts with preserved order
  chainOfThoughtParts?: ChainOfThoughtPart[];
  createdAt: number;
  attachments?: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  }>;
  // Error handling fields
  error?: MessageError;
  messageType?: "text" | "error" | "system";
}): UIMessage & { error?: MessageError; messageType?: string } {
  const parts: UIMessage["parts"] = [];

  // NEW FORMAT: Use chainOfThoughtParts if available (preserves exact stream order)
  if (msg.chainOfThoughtParts && msg.chainOfThoughtParts.length > 0) {
    // Sort by index to ensure correct order
    const sortedParts = [...msg.chainOfThoughtParts].sort((a, b) => a.index - b.index);

    for (const cotPart of sortedParts) {
      if (cotPart.type === "reasoning" && cotPart.text) {
        parts.push({ type: "reasoning", text: cotPart.text });
      } else if (cotPart.type === "tool" && cotPart.toolName) {
        parts.push({
          type: `tool-${cotPart.toolName}` as any,
          toolCallId: cotPart.toolCallId,
          state: cotPart.state || "output-available",
          input: cotPart.input,
          output: cotPart.output,
          errorText: cotPart.errorText,
        } as any);
      }
    }
  } else {
    // LEGACY FORMAT: Fallback for old messages without chainOfThoughtParts
    // Add reasoning first (legacy behavior)
    if (msg.reasoning) {
      parts.push({ type: "reasoning", text: msg.reasoning });
    }

    // Add tool invocation parts (after reasoning, before text)
    if (msg.toolInvocations) {
      for (const tool of msg.toolInvocations) {
        parts.push({
          type: `tool-${tool.toolName}` as any,
          toolCallId: tool.toolCallId,
          state: tool.state,
          input: tool.input,
          output: tool.output,
          errorText: tool.errorText,
        } as any);
      }
    }
  }

  // Add text part (skip for error messages with no content)
  // Text is always last in the message
  if (msg.content) {
    parts.push({ type: "text", text: msg.content });
  }

  // Add file parts for attachments (at the end)
  if (msg.attachments) {
    for (const attachment of msg.attachments) {
      if (attachment.url) {
        parts.push({
          type: "file",
          mediaType: attachment.contentType,
          filename: attachment.filename,
          url: attachment.url,
        } as any);
      }
    }
  }

  return {
    id: msg._id,
    role: msg.role as "user" | "assistant",
    parts,
    // Pass through error metadata for rendering
    error: msg.error,
    messageType: msg.messageType,
  };
}

export function usePersistentChat({
  chatId,
  onChatCreated,
}: UsePersistentChatOptions): UsePersistentChatReturn {
  const { user } = useAuth();
  const { selectedModelId, reasoningEffort, maxSteps } = useModelStore();
  const { apiKey } = useOpenRouterKey();
  const activeProvider = useProviderStore((s) => s.activeProvider);
  const webSearchEnabled = useProviderStore((s) => s.webSearchEnabled);

  // Check if Convex client is available (null during SSR or if env var missing)
  const isConvexAvailable = !!convexClient;

  // Track current chat ID (may change when new chat is created)
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatId ?? null);
  const chatIdRef = useRef<string | null>(chatId ?? null);

  // Track pending user message for onFinish callback (avoids stale closure)
  const pendingUserMessageRef = useRef<{ text: string; id: string } | null>(null);

  // Track mount state to prevent stale operations after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Store onChatCreated in a ref to avoid stale closure
  const onChatCreatedRef = useRef(onChatCreated);
  useEffect(() => {
    onChatCreatedRef.current = onChatCreated;
  }, [onChatCreated]);

  // Update ref when chatId prop changes
  useEffect(() => {
    if (chatId) {
      chatIdRef.current = chatId;
      setCurrentChatId(chatId);
    }
  }, [chatId]);

  // First, get the Convex user by Better Auth external ID
  // Skip if Convex client is not available (SSR or missing env)
  const convexUser = useQuery(
    api.users.getByExternalId,
    isConvexAvailable && user?.id ? { externalId: user.id } : "skip",
  );

  // Get the Convex user ID
  const convexUserId = convexUser?._id;

  // Store convexUserId in a ref to avoid stale closure in onFinish
  // This is critical because onFinish callback may capture an old value
  const convexUserIdRef = useRef(convexUserId);
  useEffect(() => {
    convexUserIdRef.current = convexUserId;
  }, [convexUserId]);

  // Convex queries and mutations
  const messagesResult = useQuery(
    api.messages.list,
    chatId && convexUserId ? { chatId: chatId as Id<"chats">, userId: convexUserId } : "skip",
  );

  const createChat = useMutation(api.chats.create);
  const sendMessages = useMutation(api.messages.send);
  const updateTitle = useMutation(api.chats.updateTitle);

  // Track if we're in new chat mode
  const isNewChat = !chatId;

  // Use AI SDK's useChat
  const {
    messages: aiMessages,
    sendMessage: aiSendMessage,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    id: chatId ?? "new-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          model: selectedModelId,
          provider: activeProvider,
          apiKey: activeProvider === "openrouter" ? apiKey : undefined,
          chatId: chatIdRef.current,
          enableWebSearch: webSearchEnabled,
          // Reasoning effort control - always send, server maps 'none' to 'minimal'
          reasoningEffort: reasoningEffort,
          // Max steps for multi-step tool calls (always enabled when tools are used)
          maxSteps: maxSteps,
        },
      }),
    }),
    onFinish: async ({ message }) => {
      // Save completed message to Convex
      // This callback runs even if the component has navigated away
      const pendingUserMessage = pendingUserMessageRef.current;
      const currentConvexUserId = convexUserIdRef.current;

      // Track usage for OSSChat Cloud provider
      // Message metadata contains token usage info sent from the server
      const metadata = message.metadata as
        | {
            model?: string;
            provider?: string;
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          }
        | undefined;

      if (metadata?.inputTokens && metadata?.outputTokens && metadata?.model) {
        const providerState = useProviderStore.getState();
        // Only track usage for OSSChat Cloud (free tier with limits)
        if (providerState.activeProvider === "osschat") {
          const costCents = calculateCost(
            metadata.model,
            metadata.inputTokens,
            metadata.outputTokens,
          );
          providerState.addUsage(costCents);

          // Warn when approaching limit (below 2¢ remaining)
          const remaining = providerState.remainingBudgetCents();
          if (remaining > 0 && remaining <= 2) {
            toast.warning("Approaching daily limit", {
              description: `Only ${remaining.toFixed(1)}¢ remaining of your free daily quota.`,
            });
          } else if (remaining <= 0) {
            toast.error("Daily limit reached", {
              description: "Add your OpenRouter API key in settings to continue.",
            });
          }
        }
      }

      // Track web search usage if tool was called
      // AI SDK 5 uses types like 'tool-webSearch' for the unified tool part type
      const hasWebSearch = message.parts?.some(
        (p) =>
          p.type === "tool-webSearch" ||
          (typeof p.type === "string" &&
            p.type.startsWith("tool-") &&
            p.type.includes("webSearch")),
      );
      if (hasWebSearch) {
        const providerState = useProviderStore.getState();
        providerState.addSearchUsage();

        // Disable web search if limit reached
        if (providerState.isSearchLimitReached()) {
          providerState.setWebSearchEnabled(false);
          toast.info("Web search disabled", {
            description: "You've reached your daily limit of 20 searches.",
          });
        }
      }

      if (chatIdRef.current && currentConvexUserId && pendingUserMessage) {
        try {
          // Get assistant response text
          const assistantText =
            message.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("\n") || "";

          // NEW: Extract chain of thought parts WITH their original indices
          // This preserves the exact order from the AI stream
          const chainOfThoughtParts: ChainOfThoughtPart[] = [];
          const allParts = message.parts || [];

          allParts.forEach((part, index) => {
            if (part.type === "reasoning") {
              const reasoningPart = part as { type: "reasoning"; text: string };
              chainOfThoughtParts.push({
                type: "reasoning",
                index,
                text: reasoningPart.text,
              });
            } else if (
              typeof part.type === "string" &&
              part.type.startsWith("tool-") &&
              part.type !== "tool-call" &&
              part.type !== "tool-result" &&
              "toolCallId" in part
            ) {
              const toolPart = part as unknown as {
                type: string;
                toolCallId: string;
                state: string;
                input?: unknown;
                output?: unknown;
                errorText?: string;
              };
              chainOfThoughtParts.push({
                type: "tool",
                index,
                toolName: toolPart.type.replace("tool-", ""),
                toolCallId: toolPart.toolCallId,
                state: toolPart.state,
                input: toolPart.input,
                output: toolPart.output,
                errorText: toolPart.errorText,
              });
            }
          });

          // Save to Convex with the NEW chainOfThoughtParts format
          await sendMessages({
            chatId: chatIdRef.current as Id<"chats">,
            userId: currentConvexUserId,
            userMessage: {
              content: pendingUserMessage.text,
              clientMessageId: pendingUserMessage.id,
              createdAt: Date.now(),
            },
            assistantMessage: {
              content: assistantText,
              clientMessageId: message.id,
              createdAt: Date.now(),
              // NEW: Use unified chainOfThoughtParts that preserves order
              chainOfThoughtParts: chainOfThoughtParts.length > 0 ? chainOfThoughtParts : undefined,
            },
          });

          // Update chat title from first message
          if (pendingUserMessage.text && !chatId) {
            const title =
              pendingUserMessage.text.slice(0, 100) +
              (pendingUserMessage.text.length > 100 ? "..." : "");
            await updateTitle({
              chatId: chatIdRef.current as Id<"chats">,
              userId: currentConvexUserId,
              title,
            });
          }

          // Clear pending message after successful save
          pendingUserMessageRef.current = null;
        } catch (e) {
          console.error("Failed to save messages to Convex:", e);
        }
      }
    },
    onError: async (error) => {
      // Save error as a message in Convex (like T3.chat inline error display)
      const pendingUserMessage = pendingUserMessageRef.current;
      const currentConvexUserId = convexUserIdRef.current;

      console.error("AI request error:", error);

      // Only save error if we have a chat and user
      if (chatIdRef.current && currentConvexUserId && pendingUserMessage) {
        try {
          // Classify the error
          const errorMessage = error.message || "An unexpected error occurred";
          const isRateLimit =
            errorMessage.toLowerCase().includes("rate limit") ||
            errorMessage.toLowerCase().includes("too many requests");
          const isAuth =
            errorMessage.toLowerCase().includes("unauthorized") ||
            errorMessage.toLowerCase().includes("authentication") ||
            errorMessage.toLowerCase().includes("api key");
          const isContextLength =
            errorMessage.toLowerCase().includes("context length") ||
            errorMessage.toLowerCase().includes("token limit");
          const isContentFilter =
            errorMessage.toLowerCase().includes("content filter") ||
            errorMessage.toLowerCase().includes("safety");

          let errorCode = "unknown";
          if (isRateLimit) errorCode = "rate_limit";
          else if (isAuth) errorCode = "auth_error";
          else if (isContextLength) errorCode = "context_length";
          else if (isContentFilter) errorCode = "content_filter";

          // Save error message to Convex
          await sendMessages({
            chatId: chatIdRef.current as Id<"chats">,
            userId: currentConvexUserId,
            userMessage: {
              content: pendingUserMessage.text,
              clientMessageId: pendingUserMessage.id,
              createdAt: Date.now(),
            },
            assistantMessage: {
              content: "", // Empty content for error messages
              clientMessageId: crypto.randomUUID(),
              createdAt: Date.now(),
              messageType: "error",
              error: {
                code: errorCode,
                message: errorMessage,
                provider: useProviderStore.getState().activeProvider,
                retryable: isRateLimit || errorCode === "unknown",
              },
            },
          });

          // Clear pending message after saving error
          pendingUserMessageRef.current = null;
        } catch (e) {
          console.error("Failed to save error message to Convex:", e);
        }
      }
    },
  });

  // Sync initial messages from Convex when they load
  useEffect(() => {
    if (chatId && messagesResult && messagesResult.length > 0) {
      const convexMessages = messagesResult.map(convexMessageToUIMessage);
      setMessages(convexMessages);
    }
  }, [chatId, messagesResult, setMessages]);

  // Check for pending message and auto-send it (for seamless navigation)
  // This runs when navigating from home page to chat page with a pending message
  const pendingMessageConsumed = useRef(false);
  useEffect(() => {
    if (!chatId || !convexUserId || pendingMessageConsumed.current) return;

    const pending = usePendingMessageStore.getState().consume(chatId);
    if (pending) {
      pendingMessageConsumed.current = true;

      // Store pending message for onFinish callback
      const messageId = crypto.randomUUID();
      pendingUserMessageRef.current = { text: pending.text, id: messageId };

      // Send the message (streaming will happen with correct useChat id)
      aiSendMessage({
        text: pending.text,
        files: pending.files,
      }).catch((e) => {
        console.error("Failed to send pending message:", e);
        pendingUserMessageRef.current = null;
      });
    }
  }, [chatId, convexUserId, aiSendMessage]);

  // Handle sending messages with new chat creation
  const handleSendMessage = useCallback(
    async (message: { text: string; files?: any[] }) => {
      if (!convexUserId) return;

      if (!message.text.trim() && (!message.files || message.files.length === 0)) {
        return;
      }

      // Check usage limits for OSSChat Cloud provider
      const providerState = useProviderStore.getState();
      if (providerState.activeProvider === "osschat") {
        if (providerState.isOverLimit()) {
          toast.error("Daily usage limit reached", {
            description:
              "You've used your free 10¢ daily limit. Add your OpenRouter API key in settings to continue.",
            action: {
              label: "Settings",
              onClick: () => (window.location.href = "/settings"),
            },
          });
          return;
        }
      }

      // If no chatId, create a new chat and navigate immediately
      // The message will be auto-sent on the new page (via pending message store)
      if (!chatIdRef.current) {
        try {
          const result = await createChat({
            userId: convexUserId,
            title: "New Chat",
          });

          const newChatId = result.chatId;

          // Store the pending message - it will be sent on the new page
          usePendingMessageStore.getState().set({
            chatId: newChatId,
            text: message.text,
            files: message.files,
          });

          // Navigate immediately - streaming will happen on the new page
          if (onChatCreatedRef.current) {
            onChatCreatedRef.current(newChatId);
          }
        } catch (e) {
          console.error("Failed to create chat:", e);
        }
      } else {
        // Existing chat - send directly
        // Store pending message for onFinish callback
        const messageId = crypto.randomUUID();
        pendingUserMessageRef.current = { text: message.text, id: messageId };

        await aiSendMessage({
          text: message.text,
          files: message.files,
        });
      }
    },
    [convexUserId, createChat, aiSendMessage],
  );

  return {
    messages: aiMessages,
    sendMessage: handleSendMessage,
    status,
    error,
    stop,
    isNewChat,
    isLoadingMessages: chatId ? messagesResult === undefined : false,
    chatId: currentChatId,
  };
}
