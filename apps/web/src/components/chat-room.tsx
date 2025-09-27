"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { authClient } from "@openchat/auth/client";
import { useChat } from "@ai-sdk/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";

import ChatComposer from "@/components/chat-composer";
import ChatMessagesFeed from "@/components/chat-messages-feed";
import { loadOpenRouterKey, removeOpenRouterKey, saveOpenRouterKey } from "@/lib/openrouter-key-storage";
import { OpenRouterLinkModal } from "@/components/openrouter-link-modal";
import { normalizeMessage, toUiMessage } from "@/lib/chat-message-utils";

type ChatRoomProps = {
  chatId: string;
  initialMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string | Date;
  }>;
};

export default function ChatRoom({ chatId, initialMessages }: ChatRoomProps) {
  const { data: session } = authClient.useSession();
  const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";
  const memoDevUser =
    typeof window !== "undefined" ? ((window as any).__DEV_USER_ID__ as string | undefined) : undefined;
  const workspaceId =
    session?.user?.id || memoDevUser || (devBypassEnabled ? process.env.NEXT_PUBLIC_DEV_USER_ID || "dev-user" : null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? "";

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string; description?: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

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
          throw new Error(typeof data?.message === "string" && data.message.length > 0 ? data.message : "Failed to fetch OpenRouter models.");
        }
        setModelOptions(data.models);
        const fallback = data.models[0]?.value ?? null;
        setSelectedModel((previous) => {
          if (!previous) return fallback;
          return data.models.some((model: any) => model.value === previous) ? previous : fallback;
        });
      } catch (error) {
        console.error("Failed to load OpenRouter models", error);
        setModelOptions([]);
        setSelectedModel(null);
        setModelsError(error instanceof Error && error.message ? error.message : "Failed to load OpenRouter models.");
      } finally {
        setModelsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const stored = await loadOpenRouterKey();
      if (stored) {
        setApiKey(stored);
        await fetchModels(stored);
      }
    })();
  }, [fetchModels]);

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      setApiKeyError(null);
      setSavingApiKey(true);
      try {
        await saveOpenRouterKey(key);
        setApiKey(key);
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

  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(320);

  const handleMissingRequirement = useCallback((reason: "apiKey" | "model") => {
    if (reason === "apiKey") {
      setApiKeyError("Add your OpenRouter API key to start chatting.");
      toast.error("OpenRouter API key required", { description: "Add your API key to start chatting with OpenChat." });
    } else {
      toast.error("Select an OpenRouter model to continue.");
    }
  }, [setApiKeyError]);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
        body: { chatId },
        headers: workspaceId
          ? async () => ({ "x-user-id": workspaceId })
          : undefined,
      }),
    [chatId, workspaceId],
  );

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: chatId,
    messages: normalizedInitial.map(toUiMessage),
    transport: chatTransport,
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

  const fileToDataUrl = useCallback(
    (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result);
            return;
          }
          reject(new Error("Failed to read attachment"));
        };
        reader.onerror = () => {
          reject(reader.error ?? new Error("Failed to read attachment"));
        };
        reader.readAsDataURL(file);
      }),
    [],
  );

  const handleSend = async ({ text, modelId, apiKey: requestApiKey, attachments }: { text: string; modelId: string; apiKey: string; attachments: File[] }) => {
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
      const uploadedParts = await Promise.all(
        attachments.map(async (file) => ({
          type: "file" as const,
          url: await fileToDataUrl(file),
          mediaType: file.type || "application/octet-stream",
          filename: file.name || undefined,
        })),
      );
      await sendMessage(
        {
          id,
          role: "user",
          parts: [...uploadedParts, { type: "text", text: content }],
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
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const busy = status === "submitted" || status === "streaming";
  const isLinked = Boolean(apiKey);
  const composerDisabled = busy || modelsLoading || !isLinked || !selectedModel;

  const conversationPaddingBottom = Math.max(composerHeight + 48, 220);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <OpenRouterLinkModal
        open={!isLinked || Boolean(modelsError)}
        saving={savingApiKey || modelsLoading}
        errorMessage={apiKeyError ?? modelsError}
        onSubmit={handleSaveApiKey}
        onTroubleshoot={() => {
          setApiKeyError(null);
          setModelsError(null);
          if (apiKey) void fetchModels(apiKey);
        }}
      />
      <ChatMessagesFeed
        chatId={chatId}
        workspaceId={workspaceId}
        initialMessages={normalizedInitial}
        optimisticMessages={messages}
        paddingBottom={conversationPaddingBottom}
        className="flex-1 rounded-xl bg-background/40 shadow-inner overflow-hidden"
      />

      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-30 flex justify-center transition-all duration-300 ease-in-out md:left-[calc(var(--sb-width)+1.5rem)] md:right-6">
        <div ref={composerRef} className="pointer-events-auto w-full max-w-3xl">
          <ChatComposer
            placeholder="Ask OpenChat a question..."
            disabled={composerDisabled}
            onSend={handleSend}
            modelOptions={modelOptions}
            modelValue={selectedModel}
            onModelChange={setSelectedModel}
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
