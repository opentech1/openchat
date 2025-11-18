"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";
import { useChat } from "@ai-sdk-tools/store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";

import ChatComposer from "@/components/chat-composer";
import ChatMessagesFeed from "@/components/chat-messages-feed";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { OpenRouterLinkModalLazy as OpenRouterLinkModal } from "@/components/lazy/openrouter-link-modal-lazy";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  captureClientEvent,
  identifyClient,
  registerClientProperties,
} from "@/lib/posthog";
import { LiveRegion } from "@/components/ui/live-region";
import {
  readCachedModels,
  writeCachedModels,
} from "@/lib/openrouter-model-cache";
import { readChatPrefetch, storeChatPrefetch } from "@/lib/chat-prefetch-cache";
import type { PrefetchMessage } from "@/lib/chat-prefetch-cache";
import type { ModelSelectorOption } from "@/components/model-selector";
import { logError } from "@/lib/logger";
import { isApiError } from "@/lib/error-handling";
import {
  getStorageItemSync,
  setStorageItemSync,
  removeStorageItemSync,
} from "@/lib/storage";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { toConvexUserId, toConvexChatId } from "@/lib/type-converters";
import { LOCAL_STORAGE_KEYS, SESSION_STORAGE_KEYS } from "@/config/storage-keys";
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
};

const MESSAGE_THROTTLE_MS = getMessageThrottle();

// OpenRouter state reducer (apiKey now managed by useOpenRouterKey hook)
type OpenRouterState = {
  savingApiKey: boolean;
  apiKeyError: string | null;
  modelsError: string | null;
  modelsLoading: boolean;
  modelOptions: ModelSelectorOption[];
  selectedModel: string | null;
  checkedApiKey: boolean;
  keyPromptDismissed: boolean;
};

type OpenRouterAction =
  | { type: "SET_SAVING_API_KEY"; payload: boolean }
  | { type: "SET_API_KEY_ERROR"; payload: string | null }
  | { type: "SET_MODELS_ERROR"; payload: string | null }
  | { type: "SET_MODELS_LOADING"; payload: boolean }
  | { type: "SET_MODEL_OPTIONS"; payload: ModelSelectorOption[] }
  | { type: "SET_SELECTED_MODEL"; payload: string | null }
  | { type: "SET_CHECKED_API_KEY"; payload: boolean }
  | { type: "SET_KEY_PROMPT_DISMISSED"; payload: boolean }
  | { type: "CLEAR_MODELS" }
  | { type: "RESET_ERRORS" };

function openRouterReducer(
  state: OpenRouterState,
  action: OpenRouterAction,
): OpenRouterState {
  switch (action.type) {
    case "SET_SAVING_API_KEY":
      return { ...state, savingApiKey: action.payload };
    case "SET_API_KEY_ERROR":
      return { ...state, apiKeyError: action.payload };
    case "SET_MODELS_ERROR":
      return { ...state, modelsError: action.payload };
    case "SET_MODELS_LOADING":
      return { ...state, modelsLoading: action.payload };
    case "SET_MODEL_OPTIONS":
      return { ...state, modelOptions: action.payload };
    case "SET_SELECTED_MODEL":
      return { ...state, selectedModel: action.payload };
    case "SET_CHECKED_API_KEY":
      return { ...state, checkedApiKey: action.payload };
    case "SET_KEY_PROMPT_DISMISSED":
      return { ...state, keyPromptDismissed: action.payload };
    case "CLEAR_MODELS":
      return {
        ...state,
        modelOptions: [],
        selectedModel: null,
      };
    case "RESET_ERRORS":
      return {
        ...state,
        apiKeyError: null,
        modelsError: null,
      };
    default:
      return state;
  }
}

const initialOpenRouterState: OpenRouterState = {
  savingApiKey: false,
  apiKeyError: null,
  modelsError: null,
  modelsLoading: false,
  modelOptions: [],
  selectedModel: null,
  checkedApiKey: false,
  keyPromptDismissed: true, // Start dismissed - only show when user clicks "Add key" in toast
};

function ChatRoom({ chatId, initialMessages }: ChatRoomProps) {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const workspaceId = user?.id ?? null;

  // Get Convex user from shared context
  const { convexUser } = useConvexUser();
  const convexUserId = convexUser?._id ?? null;

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

  // Use reducer for OpenRouter state management (excluding apiKey which comes from hook)
  const [openRouterState, dispatch] = useReducer(
    openRouterReducer,
    initialOpenRouterState,
  );
  const {
    savingApiKey,
    apiKeyError,
    modelsError,
    modelsLoading,
    modelOptions,
    selectedModel,
    checkedApiKey,
    keyPromptDismissed,
  } = openRouterState;

  const storedModelIdRef = useRef<string | null>(null);
  const fetchModelsAbortControllerRef = useRef<AbortController | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [shouldAutoSend, setShouldAutoSend] = useState(false);
  const autoSendAttemptedRef = useRef(false);

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
      dispatch({ type: "SET_SELECTED_MODEL", payload: pendingModel });
      setStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL, pendingModel);
      storedModelIdRef.current = pendingModel;
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_MODEL);
    }
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      dispatch({ type: "SET_MODEL_OPTIONS", payload: cached });
      const stored = storedModelIdRef.current;
      const initialModel =
        stored && cached.some((option) => option.value === stored)
          ? stored
          : (cached[0]?.value ?? null);
      if (initialModel) {
        dispatch({ type: "SET_SELECTED_MODEL", payload: initialModel });
      }
    }
  }, []);

  const persistSelectedModel = useCallback((next: string | null) => {
    if (next) {
      setStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL, next);
    } else {
      removeStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL);
    }
    storedModelIdRef.current = next;
  }, []);

  const applySelectedModel = useCallback(
    (next: string | null) => {
      if (selectedModel !== next) {
        persistSelectedModel(next);
        dispatch({ type: "SET_SELECTED_MODEL", payload: next });
      }
    },
    [persistSelectedModel, selectedModel],
  );

  useEffect(() => {
    const stored = getStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL);
    storedModelIdRef.current = stored;
    if (stored && !selectedModel) {
      dispatch({ type: "SET_SELECTED_MODEL", payload: stored });
    }
  }, []);

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

  const fetchModels = useCallback(
    async (key: string) => {
      // Cancel any in-flight request to prevent race conditions
      if (fetchModelsAbortControllerRef.current) {
        fetchModelsAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      fetchModelsAbortControllerRef.current = abortController;

      dispatch({ type: "SET_MODELS_LOADING", payload: true });
      dispatch({ type: "SET_MODELS_ERROR", payload: null });
      try {
        const response = await fetchWithCsrf("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          if (response.status === 401) {
            void removeKey();
            dispatch({ type: "CLEAR_MODELS" });
          }
          const errorMessage =
            typeof data?.message === "string" && data.message.length > 0
              ? data.message
              : "Failed to fetch OpenRouter models.";
          let providerHost = "openrouter.ai";
          try {
            const baseUrl =
              process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ??
              "https://openrouter.ai/api/v1";
            providerHost = new URL(response.url ?? baseUrl).host;
          } catch {
            providerHost = "openrouter.ai";
          }
          captureClientEvent("openrouter.models_fetch_failed", {
            status: response.status,
            error_message: errorMessage,
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
          throw Object.assign(new Error(errorMessage), {
            __posthogTracked: true,
            status: response.status,
            providerUrl: response.url,
          });
        }
        const parsedModels = data.models as ModelSelectorOption[];
        dispatch({ type: "SET_MODEL_OPTIONS", payload: parsedModels });
        writeCachedModels(parsedModels);
        const fallback = parsedModels[0]?.value ?? null;
        const storedPreferred = storedModelIdRef.current;
        let nextModel: string | null = selectedModel;
        if (
          storedPreferred &&
          parsedModels.some((model) => model.value === storedPreferred)
        ) {
          nextModel = storedPreferred;
        } else if (
          !selectedModel ||
          !parsedModels.some((model) => model.value === selectedModel)
        ) {
          nextModel = fallback;
        }
        if (nextModel !== selectedModel) {
          persistSelectedModel(nextModel ?? null);
          dispatch({ type: "SET_SELECTED_MODEL", payload: nextModel ?? null });
        }
      } catch (error) {
        // Ignore abort errors (request was cancelled)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        logError("Failed to load OpenRouter models", error);
        if (isApiError(error) && !error.__posthogTracked) {
          const status = typeof error.status === "number" ? error.status : 0;
          let providerHost = "openrouter.ai";
          const providerUrl = error.providerUrl;
          if (typeof providerUrl === "string" && providerUrl.length > 0) {
            try {
              providerHost = new URL(providerUrl).host;
            } catch {
              providerHost = "openrouter.ai";
            }
          }
          captureClientEvent("openrouter.models_fetch_failed", {
            status,
            error_message:
              error instanceof Error && error.message
                ? error.message
                : "Failed to load OpenRouter models.",
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
        }
        dispatch({ type: "CLEAR_MODELS" });
        dispatch({
          type: "SET_MODELS_ERROR",
          payload:
            error instanceof Error && error.message
              ? error.message
              : "Failed to load OpenRouter models.",
        });
      } finally {
        // Only clear loading if this is still the active request
        if (fetchModelsAbortControllerRef.current === abortController) {
          dispatch({ type: "SET_MODELS_LOADING", payload: false });
          fetchModelsAbortControllerRef.current = null;
        }
      }
    },
    [persistSelectedModel, selectedModel, removeKey],
  );

  // Cleanup: abort pending requests on unmount
  useEffect(() => {
    return () => {
      if (fetchModelsAbortControllerRef.current) {
        fetchModelsAbortControllerRef.current.abort();
        fetchModelsAbortControllerRef.current = null;
      }
    };
  }, []);

  // Fetch models when API key is loaded
  useEffect(() => {
    // Mark that we've checked for API key once the hook finishes loading
    if (!keyLoading) {
      dispatch({ type: "SET_CHECKED_API_KEY", payload: true });
    }

    // Fetch models when key becomes available
    if (apiKey && !keyLoading) {
      void fetchModels(apiKey);
    }
  }, [apiKey, keyLoading, fetchModels]);

  useEffect(() => {
    if (modelOptions.length === 0) return;
    const stored = storedModelIdRef.current;
    if (!stored || selectedModel) return;
    const exists = modelOptions.some((option) => option.value === stored);
    if (exists) {
      dispatch({ type: "SET_SELECTED_MODEL", payload: stored });
    }
  }, [modelOptions, selectedModel]);

  // No longer showing toast for missing API key - placeholder message is sufficient

  useEffect(() => {
    if (!apiKey) return;
    dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: false });
  }, [apiKey]);

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      dispatch({ type: "SET_API_KEY_ERROR", payload: null });
      dispatch({ type: "SET_SAVING_API_KEY", payload: true });
      try {
        await saveKey(key);
        dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: false });
        registerClientProperties({ has_openrouter_key: true });
        captureClientEvent("openrouter.key_saved", {
          source: "modal",
          masked_tail: key.slice(-4),
          scope: "workspace",
        });
        await fetchModels(key);
      } catch (error) {
        logError("Failed to save OpenRouter API key", error);
        dispatch({
          type: "SET_API_KEY_ERROR",
          payload:
            error instanceof Error && error.message
              ? error.message
              : "Failed to save OpenRouter API key.",
        });
      } finally {
        dispatch({ type: "SET_SAVING_API_KEY", payload: false });
      }
    },
    [saveKey, fetchModels],
  );

  const normalizedInitial = useMemo(
    () => initialMessages.map(normalizeMessage),
    [initialMessages],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = normalizedInitial.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));
    storeChatPrefetch(chatId, payload);
  }, [chatId, normalizedInitial]);

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
            dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: false });
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

  useEffect(() => {
    const entry = readChatPrefetch(chatId);
    if (!entry) return;
    const normalized = entry.messages.map((message) =>
      normalizeMessage({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      }),
    );
    const uiMessages = normalized.map(toUiMessage);
    setMessages(uiMessages);
  }, [chatId, setMessages]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!messages.length) return;
    const payload = messages
      .map((message) => {
        const textPart = message.parts.find(
          (part): part is { type: "text"; text: string } =>
            part.type === "text" && typeof part.text === "string",
        );
        const role =
          message.role === "assistant"
            ? "assistant"
            : message.role === "user"
              ? "user"
              : null;
        if (!role) return null;
        return {
          id: message.id,
          role,
          content: textPart?.text ?? "",
          createdAt:
            (message.metadata?.createdAt &&
              new Date(message.metadata.createdAt).toISOString()) ||
            new Date().toISOString(),
        };
      })
      .filter((message): message is PrefetchMessage => Boolean(message));

    if (payload.length === 0) return;

    const timeoutId = setTimeout(() => {
      storeChatPrefetch(chatId, payload);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [chatId, messages, status]);

  const handleSend = useCallback(
    async ({
      text,
      modelId,
      apiKey: requestApiKey,
      attachments,
      reasoningConfig,
    }: {
      text: string;
      modelId: string;
      apiKey: string;
      attachments?: any[];
      reasoningConfig?: any;
    }) => {
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
      } catch (error) {
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
          let limitHeader: number | undefined;
          let windowHeader: number | undefined;
          if (error instanceof Response) {
            const limit =
              error.headers.get("x-ratelimit-limit") ||
              error.headers.get("X-RateLimit-Limit");
            const windowMs =
              error.headers.get("x-ratelimit-window") ||
              error.headers.get("X-RateLimit-Window");
            const parsedLimit = limit ? Number(limit) : Number.NaN;
            const parsedWindow = windowMs ? Number(windowMs) : Number.NaN;
            limitHeader = Number.isFinite(parsedLimit)
              ? parsedLimit
              : undefined;
            windowHeader = Number.isFinite(parsedWindow)
              ? parsedWindow
              : undefined;
          }
          captureClientEvent("chat.rate_limited", {
            chat_id: chatId,
            limit: limitHeader,
            window_ms: windowHeader,
          });
        } else if (status === 401) {
          await removeKey();
          dispatch({ type: "CLEAR_MODELS" });
          dispatch({
            type: "SET_MODELS_ERROR",
            payload:
              "OpenRouter rejected your API key. Re-enter it to continue.",
          });
          toast.error("OpenRouter API key invalid", {
            description:
              "We cleared the saved key. Add a valid key to keep chatting.",
          });
          // Don't call handleMissingRequirement here - toast above is sufficient
          return;
        }
        logError("Failed to send message", error);
        // Re-throw error so chat-composer can restore the message
        throw error;
      }
    },
    [chatId, sendMessage, handleMissingRequirement, removeKey],
  );

  const handleModelSelection = useCallback(
    (next: string) => {
      applySelectedModel(next);
    },
    [applySelectedModel],
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
    });
  }, [shouldAutoSend, pendingMessage, selectedModel, apiKey, status, handleSend]);

  const _busy = status === "submitted" || status === "streaming";
  const isLinked = Boolean(apiKey);
  // Only show modal when user explicitly wants to add key (via toast action or settings)
  const showKeyModal = !keyPromptDismissed && checkedApiKey && !isLinked;
  // Don't disable composer - let users type even without key
  const composerDisabled = false;
  // Don't disable send button when streaming - user needs to be able to click stop
  // Also don't block sending without API key - let handleSend show the toast instead
  const sendDisabled = (status === "submitted") || modelsLoading || !selectedModel;

  const conversationPaddingBottom = Math.max(composerHeight + 48, 220);

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-4 focus:outline-none focus-visible:outline-none">
      {/* Screen reader announcements for loading states */}
      <LiveRegion
        message={status === "submitted" ? "Sending message..." : status === "streaming" ? "Receiving response..." : ""}
        politeness="polite"
      />
      <OpenRouterLinkModal
        open={showKeyModal}
        saving={savingApiKey || modelsLoading}
        errorMessage={apiKeyError ?? modelsError}
        onSubmit={handleSaveApiKey}
        onTroubleshoot={() => {
          dispatch({ type: "RESET_ERRORS" });
          if (apiKey) void fetchModels(apiKey);
        }}
        onClose={() => {
          dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: true });
        }}
        hasApiKey={Boolean(apiKey)}
      />
      <ChatMessagesFeed
        initialMessages={normalizedInitial}
        optimisticMessages={messages}
        paddingBottom={conversationPaddingBottom}
        className="flex-1 rounded-xl bg-background/40 shadow-inner"
        isStreaming={status === "streaming"}
        userId={convexUserId as string | null}
        chatId={chatId}
      />

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-30 flex justify-center transition-all duration-300 ease-in-out md:left-[calc(var(--sb-width)+1rem)] md:right-4">
        <div ref={composerRef} className="pointer-events-auto w-full max-w-3xl">
          <ErrorBoundary level="section" resetKeys={[chatId]}>
            <ChatComposer
              placeholder="Type your message..."
              sendDisabled={sendDisabled}
              disabled={composerDisabled}
              onSend={handleSend}
              modelOptions={modelOptions}
              modelValue={selectedModel}
              onModelChange={handleModelSelection}
              modelsLoading={modelsLoading}
              apiKey={apiKey}
              isStreaming={status === "streaming"}
              onStop={() => stop()}
              onMissingRequirement={handleMissingRequirement}
              userId={convexUserId}
              chatId={toConvexChatId(chatId)}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

ChatRoom.displayName = "ChatRoom";

export default React.memo(ChatRoom);
