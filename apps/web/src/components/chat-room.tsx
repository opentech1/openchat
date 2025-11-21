"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import ChatComposer from "@/components/chat-composer";
import ChatMessagesFeed from "@/components/chat-messages-feed";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { useJonMode } from "@/hooks/use-jon-mode";
import { OpenRouterLinkModalLazy as OpenRouterLinkModal } from "@/components/lazy/openrouter-link-modal-lazy";
import { normalizeMessage } from "@/lib/chat-message-utils";
import { ErrorBoundary } from "@/components/error-boundary";
import { registerClientProperties } from "@/lib/posthog";
import { LiveRegion } from "@/components/ui/live-region";
import { toConvexChatId } from "@/lib/type-converters";
import { useConvexUser } from "@/contexts/convex-user-context";
import { useChatState } from "@/components/chat-room/use-chat-state";
import { useChatTelemetry } from "@/components/chat-room/use-chat-telemetry";
import { useMessageHandler } from "@/components/chat-room/message-handler";
import type { ConvexFileAttachment } from "@/lib/convex-types";
import type { ReasoningConfig } from "@/lib/reasoning-config";

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

  // Use custom hooks for state management
  const chatState = useChatState();

  // Jon Mode: Get em-dash prevention setting
  const { jonMode } = useJonMode();

  const {
    apiKey,
    keyLoading,
    savingApiKey,
    apiKeyError,
    modelsError,
    modelsLoading,
    modelOptions,
    selectedModel,
    checkedApiKey,
    keyPromptDismissed,
    pendingMessage,
    shouldAutoSend,
    autoSendAttemptedRef,
    handleSaveApiKey,
    applySelectedModel,
    dispatch,
    fetchModels,
    removeKey,
    setPendingMessage,
    setShouldAutoSend,
  } = chatState;

  // Track telemetry
  useChatTelemetry({ workspaceId, apiKey });


  // Handle openrouter query param cleanup
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
  }, [dispatch]);

  // Normalize initial messages for display
  const normalizedInitial = React.useMemo(
    () => initialMessages.map(normalizeMessage),
    [initialMessages],
  );

  // Use message handler hook
  const { messages, setMessages, status, stop, handleSend } = useMessageHandler({
    chatId,
    initialMessages,
    onMissingRequirement: handleMissingRequirement,
    removeKey,
    dispatch,
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
              messages={messages}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

ChatRoom.displayName = "ChatRoom";

export default React.memo(ChatRoom);
