"use client";

import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { authClient } from '@/lib/auth-client';
import { useChat } from "@ai-sdk-tools/store";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";

import ChatComposer from "@/components/chat-composer";
import ChatMessagesFeed from "@/components/chat-messages-feed";
import { loadOpenRouterKey, removeOpenRouterKey, saveOpenRouterKey } from "@/lib/openrouter-key-storage";
import { OpenRouterLinkModal } from "@/components/openrouter-link-modal";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";
import { captureClientEvent, identifyClient, registerClientProperties } from "@/lib/posthog";
import { readCachedModels, writeCachedModels } from "@/lib/openrouter-model-cache";
import { readChatPrefetch, storeChatPrefetch } from "@/lib/chat-prefetch-cache";
import type { PrefetchMessage } from "@/lib/chat-prefetch-cache";
import type { ModelSelectorOption } from "@/components/model-selector";

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string | Date;
  }>;
};

const LAST_MODEL_STORAGE_KEY = "openchat:last-model";
const MESSAGE_THROTTLE_MS = Number(process.env.NEXT_PUBLIC_CHAT_THROTTLE_MS ?? 80);

export default function ChatRoom({ chatId, initialMessages }: ChatRoomProps) {
  const { data: session } = authClient.useSession(); const user = session?.user;
  const workspaceId = user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!workspaceId) return;
    identifyClient(workspaceId, {
      workspaceId,
      properties: { auth_state: "member" },
    });
    registerClientProperties({
      auth_state: "member",
      workspace_id: workspaceId,
    });
  }, [workspaceId]);


  const [apiKey, setApiKey] = useState<string | null>(null);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelSelectorOption[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(null);
  const [checkedApiKey, setCheckedApiKey] = useState(false);
  const [keyPromptDismissed, setKeyPromptDismissed] = useState(false);
  const missingKeyToastRef = useRef<string | number | null>(null);
  const storedModelIdRef = useRef<string | null>(null);

  useEffect(() => {
    registerClientProperties({ has_openrouter_key: Boolean(apiKey) });
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      setModelOptions(cached);
      setSelectedModelState((prev) => {
        if (prev) return prev;
        const stored = storedModelIdRef.current;
        if (stored && cached.some((option) => option.value === stored)) {
          return stored;
        }
        return cached[0]?.value ?? null;
      });
    }
  }, []);

  const persistSelectedModel = useCallback((next: string | null) => {
    if (typeof window !== "undefined") {
      try {
        if (next) {
          window.localStorage.setItem(LAST_MODEL_STORAGE_KEY, next);
        } else {
          window.localStorage.removeItem(LAST_MODEL_STORAGE_KEY);
        }
      } catch {
        // ignore storage failures
      }
    }
    storedModelIdRef.current = next;
  }, []);

  const applySelectedModel = useCallback(
    (next: string | null) => {
      setSelectedModelState((prev) => {
        if (prev === next) return prev;
        persistSelectedModel(next);
        return next;
      });
    },
    [persistSelectedModel],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LAST_MODEL_STORAGE_KEY);
    storedModelIdRef.current = stored;
    if (stored) {
      setSelectedModelState((prev) => prev ?? stored);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    if (params.has("openrouter")) {
      params.delete("openrouter");
      const query = params.toString();
      type ReplaceArg = Parameters<typeof router.replace>[0];
      const replaceTarget = query
        ? ({ pathname, query: Object.fromEntries(params.entries()) } as unknown as ReplaceArg)
        : (pathname as unknown as ReplaceArg);
      router.replace(replaceTarget);
    }
  }, [pathname, router, searchParamsString]);

  const fetchModels = useCallback(
    async (key: string) => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetch("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          if (response.status === 401) {
            removeOpenRouterKey();
            setApiKey(null);
          }
          const errorMessage =
            typeof data?.message === "string" && data.message.length > 0
              ? data.message
              : "Failed to fetch OpenRouter models.";
          let providerHost = "openrouter.ai";
          try {
            providerHost = new URL(response.url ?? "https://openrouter.ai/api/v1").host;
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
        setModelOptions(parsedModels);
        writeCachedModels(parsedModels);
        const fallback = parsedModels[0]?.value ?? null;
        setSelectedModelState((previous) => {
          const storedPreferred = storedModelIdRef.current;
          let next: string | null = previous;
          if (storedPreferred && parsedModels.some((model) => model.value === storedPreferred)) {
            next = storedPreferred;
          } else if (!previous || !parsedModels.some((model) => model.value === previous)) {
            next = fallback;
          }
          if (next !== previous) persistSelectedModel(next ?? null);
          return next ?? null;
        });
      } catch (error) {
        console.error("Failed to load OpenRouter models", error);
        if (!(error as any)?.__posthogTracked) {
          const status = typeof (error as any)?.status === "number" ? (error as any).status : 0;
          let providerHost = "openrouter.ai";
          const providerUrl = (error as any)?.providerUrl;
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
              error instanceof Error && error.message ? error.message : "Failed to load OpenRouter models.",
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
        }
        setModelOptions([]);
        applySelectedModel(null);
        setModelsError(error instanceof Error && error.message ? error.message : "Failed to load OpenRouter models.");
      } finally {
        setModelsLoading(false);
      }
    },
    [persistSelectedModel],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await loadOpenRouterKey();
        if (!active) return;
        if (stored) {
          setApiKey(stored);
          await fetchModels(stored);
        }
      } finally {
        if (active) setCheckedApiKey(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchModels]);

  useEffect(() => {
    if (modelOptions.length === 0) return;
    const stored = storedModelIdRef.current;
    if (!stored) return;
    setSelectedModelState((previous) => {
      if (previous) return previous;
      const exists = modelOptions.some((option) => option.value === stored);
      if (!exists) return previous;
      return stored;
    });
  }, [modelOptions]);

  useEffect(() => {
    if (!checkedApiKey) return;
    if (!apiKey) {
      if (missingKeyToastRef.current == null) {
        missingKeyToastRef.current = toast.warning("Add your OpenRouter API key", {
          description: "Open settings to paste your key and start chatting.",
          duration: 8000,
          action: {
            label: "Settings",
            onClick: () => router.push("/dashboard/settings"),
          },
        });
      }
    } else if (missingKeyToastRef.current !== null) {
      toast.dismiss(missingKeyToastRef.current);
      missingKeyToastRef.current = null;
    }
  }, [apiKey, router, checkedApiKey]);

  useEffect(() => {
    if (!apiKey) return;
    setKeyPromptDismissed(false);
  }, [apiKey]);

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      setApiKeyError(null);
      setSavingApiKey(true);
      try {
        await saveOpenRouterKey(key);
        setApiKey(key);
        setKeyPromptDismissed(false);
        registerClientProperties({ has_openrouter_key: true });
        captureClientEvent("openrouter.key_saved", {
          source: "modal",
          masked_tail: key.slice(-4),
          scope: "workspace",
        });
        await fetchModels(key);
      } catch (error) {
        console.error("Failed to save OpenRouter API key", error);
        setApiKeyError(error instanceof Error && error.message ? error.message : "Failed to save OpenRouter API key.");
      } finally {
        setSavingApiKey(false);
      }
    },
    [fetchModels],
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
      setKeyPromptDismissed(false);
      setModelsError(null);
      setApiKeyError("Add your OpenRouter API key to start chatting.");
      toast.error("OpenRouter API key required", { description: "Add your API key to start chatting with OpenChat." });
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
    experimental_throttle: Number.isFinite(MESSAGE_THROTTLE_MS) && MESSAGE_THROTTLE_MS > 0 ? MESSAGE_THROTTLE_MS : undefined,
    onFinish: async ({ message, isAbort, isError }) => {
      if (isAbort || isError) return;
      const assistantCreatedAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? { ...item, metadata: { ...item.metadata, createdAt: assistantCreatedAt } }
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
      }
      console.error("Chat stream error", error);
    },
  });

  useLayoutEffect(() => {
    const wrapper = composerRef.current;
    if (!wrapper || typeof window === "undefined" || !("ResizeObserver" in window)) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const blockSize = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        setComposerHeight(blockSize);
      }
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

	const [visibleMessages, setVisibleMessages] = useState(messages);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		startTransition(() => {
			setVisibleMessages(messages);
		});
	}, [messages, startTransition]);

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
		startTransition(() => {
			setMessages(uiMessages);
		});
	}, [chatId, setMessages, startTransition]);

  useEffect(() => {
    if (status !== "ready") return;
    if (!messages.length) return;
	const payload = messages
		.map((message) => {
			const textPart = message.parts.find(
				(part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string",
			);
			const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : null;
			if (!role) return null;
			return {
				id: message.id,
				role,
				content: textPart?.text ?? "",
				createdAt:
					(message.metadata?.createdAt && new Date(message.metadata.createdAt).toISOString()) ||
					new Date().toISOString(),
			};
		})
		.filter((message): message is PrefetchMessage => Boolean(message));
	if (payload.length > 0) {
		storeChatPrefetch(chatId, payload);
	}
}, [chatId, messages, status]);

  const handleSend = async ({ text, modelId, apiKey: requestApiKey }: { text: string; modelId: string; apiKey: string }) => {
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
          metadata: { createdAt },
        },
        {
          body: {
            chatId,
            modelId,
            apiKey: requestApiKey,
          },
        },
      );
      captureClientEvent("chat_message_submitted", {
        chat_id: chatId,
        model_id: modelId,
        characters: content.length,
        has_api_key: Boolean(requestApiKey),
      });
    } catch (error) {
      const status =
        error instanceof Response
          ? error.status
          : typeof (error as any)?.status === "number"
            ? (error as any).status
            : typeof (error as any)?.cause?.status === "number"
              ? (error as any).cause.status
              : null;
      if (status === 429) {
        let limitHeader: number | undefined;
        let windowHeader: number | undefined;
        if (error instanceof Response) {
          const limit = error.headers.get("x-ratelimit-limit") || error.headers.get("X-RateLimit-Limit");
          const windowMs = error.headers.get("x-ratelimit-window") || error.headers.get("X-RateLimit-Window");
          const parsedLimit = limit ? Number(limit) : Number.NaN;
          const parsedWindow = windowMs ? Number(windowMs) : Number.NaN;
          limitHeader = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
          windowHeader = Number.isFinite(parsedWindow) ? parsedWindow : undefined;
        }
        captureClientEvent("chat.rate_limited", {
          chat_id: chatId,
          limit: limitHeader,
          window_ms: windowHeader,
        });
      } else if (status === 401) {
        await removeOpenRouterKey();
        setApiKey(null);
        setModelsError("OpenRouter rejected your API key. Re-enter it to continue.");
        toast.error("OpenRouter API key invalid", {
          description: "We cleared the saved key. Add a valid key to keep chatting.",
        });
        handleMissingRequirement("apiKey");
        return;
      }
      console.error("Failed to send message", error);
    }
  };

  const handleModelSelection = useCallback(
    (next: string) => {
      applySelectedModel(next);
    },
    [applySelectedModel],
  );

  const busy = status === "submitted" || status === "streaming";
  const isLinked = Boolean(apiKey);
  const shouldPromptForKey = !isLinked;
  const shouldForceModal = Boolean(modelsError);
  const showKeyModal = checkedApiKey && (shouldForceModal || (shouldPromptForKey && !keyPromptDismissed));
  const composerDisabled = shouldPromptForKey;
  const sendDisabled = busy || modelsLoading || shouldPromptForKey || !selectedModel;

  const conversationPaddingBottom = Math.max(composerHeight + 48, 220);

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <OpenRouterLinkModal
        open={showKeyModal}
        saving={savingApiKey || modelsLoading}
        errorMessage={apiKeyError ?? modelsError}
        onSubmit={handleSaveApiKey}
        onTroubleshoot={() => {
          setApiKeyError(null);
          setModelsError(null);
          if (apiKey) void fetchModels(apiKey);
        }}
        onClose={() => {
          if (shouldForceModal) return;
          setKeyPromptDismissed(true);
        }}
        hasApiKey={Boolean(apiKey)}
      />
      <ChatMessagesFeed
        initialMessages={normalizedInitial}
        optimisticMessages={visibleMessages}
        paddingBottom={conversationPaddingBottom}
        className="flex-1 rounded-xl bg-background/40 shadow-inner overflow-hidden"
        loading={isPending && visibleMessages.length === 0}
      />

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-30 flex justify-center transition-all duration-300 ease-in-out md:left-[calc(var(--sb-width)+1.5rem)] md:right-6">
        <div ref={composerRef} className="pointer-events-auto w-full max-w-3xl">
			<ChatComposer
				placeholder="Ask OpenChat a question..."
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
			/>
        </div>
      </div>
    </div>
  );
}
