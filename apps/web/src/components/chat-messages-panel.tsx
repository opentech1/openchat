"use client";

import { ArrowDownIcon } from "@/lib/icons";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
// NOTE: useVirtualizer removed - disabled due to React 19 hydration issues
// See: https://github.com/TanStack/virtual/issues/743

import { Button } from "@/components/ui/button";
import { ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SafeStreamdown } from "@/components/safe-streamdown";
import { throttleRAF } from "@/lib/throttle";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { FilePreview } from "@/components/file-preview";
import { ProgressiveThinkingIndicator } from "@/components/progressive-thinking-indicator";
import type { WaitState } from "@/hooks/use-progressive-wait-detection";

type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  thinkingTimeMs?: number;
  attachments?: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: number;
  }>;
};

type ChatMessagesPanelProps = {
  messages: ChatMessage[];
  paddingBottom: number;
  className?: string;
  loading?: boolean;
  autoStick?: boolean;
  isStreaming?: boolean;
  isSubmitted?: boolean;
  userId?: string | null;
  chatId?: string;
  waitState?: WaitState;
  elapsedSeconds?: number;
  selectedModelName?: string;
};

// Threshold for considering user "at bottom" - increased for better UX
const SCROLL_LOCK_THRESHOLD_PX = 100;

// Thinking indicator shown when model is processing but no content yet
const ThinkingIndicator = memo(() => (
  <div className="flex items-center gap-2 py-2 animate-in fade-in duration-200">
    <div className="flex gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
    </div>
    <span className="text-muted-foreground text-xs">Generating response...</span>
  </div>
));
ThinkingIndicator.displayName = "ThinkingIndicator";

function ChatMessagesPanelComponent({
  messages,
  paddingBottom,
  className,
  autoStick = true,
  loading = false,
  isStreaming = false,
  isSubmitted = false,
  userId,
  chatId,
  waitState = "normal",
  elapsedSeconds = 0,
  selectedModelName,
}: ChatMessagesPanelProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Start with isAtBottom = false until we actually scroll to bottom
  const [isAtBottom, setIsAtBottom] = useState(false);
  const shouldStickRef = useRef(true);
  const lastSignatureRef = useRef<string | null>(null);
  const lastChatIdRef = useRef<string | undefined>(chatId);
  const isResizingRef = useRef(false);
  // Track if viewport ref is attached to DOM
  const [viewportReady, setViewportReady] = useState(false);
  // Guard ref to prevent infinite loop from repeated state updates
  const viewportReadySetRef = useRef(false);
  // Track if we've done initial scroll for this chat
  const hasScrolledForChatRef = useRef(false);

  // Callback ref to detect when viewport is attached to DOM
  // IMPORTANT: Use a guard ref to prevent calling setViewportReady multiple times.
  // Radix UI's composeRefs may call this callback during render, and setting state
  // unconditionally during render causes "Maximum update depth exceeded" error.
  const setViewportRefCallback = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (node && !viewportReadySetRef.current) {
      viewportReadySetRef.current = true;
      setViewportReady(true);
    }
  }, []);

  // Reset scroll state when switching to a different chat
  useEffect(() => {
    if (chatId && chatId !== lastChatIdRef.current) {
      lastChatIdRef.current = chatId;
      shouldStickRef.current = true;
      lastSignatureRef.current = null;
      hasScrolledForChatRef.current = false;
      // Reset viewport ready state for new chat
      viewportReadySetRef.current = false;
      setViewportReady(false);
      setIsAtBottom(false);
    }
  }, [chatId]);

  const hasMessages = messages.length > 0;
  const tailSignature = useMemo(() => {
    if (!hasMessages) return null;
    const last = messages[messages.length - 1]!;
    return `${last.id}:${last.role}:${last.content.length}`;
  }, [hasMessages, messages]);

  // NOTE: Virtualization disabled due to React 19 hydration issues with @tanstack/react-virtual
  // The library causes infinite re-render loops (error #185) and hydration mismatches (#418)
  // See: https://github.com/TanStack/virtual/issues/743
  // See: https://github.com/TanStack/virtual/issues/924

  const computeIsAtBottom = useCallback((node: HTMLDivElement) => {
    return (
      node.scrollHeight - node.scrollTop - node.clientHeight <=
      SCROLL_LOCK_THRESHOLD_PX
    );
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = viewportRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const syncScrollPosition = useCallback(
    (forceInstant = false) => {
      if (!autoStick) return;
      if (!hasMessages) return;
      if (!shouldStickRef.current && !forceInstant) return;
      scrollToBottom(forceInstant ? "auto" : "smooth");
    },
    [autoStick, hasMessages, scrollToBottom],
  );

  // SCROLL TO BOTTOM: When viewport is ready AND messages exist
  // This is the MAIN scroll effect that handles initial scroll to bottom
  useLayoutEffect(() => {
    // Wait for viewport to be attached to DOM
    if (!viewportReady) return;
    // Wait for messages to exist
    if (!hasMessages) return;
    // Only scroll once per chat
    if (hasScrolledForChatRef.current) return;
    
    const node = viewportRef.current;
    if (!node) return;
    
    // Mark as scrolled immediately to prevent re-runs
    hasScrolledForChatRef.current = true;
    
    // Track cleanup state
    let cancelled = false;
    let raf1: number | undefined;
    let raf2: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    // Aggressive scroll with multiple retries to ensure it works
    const doScroll = () => {
      if (cancelled || !viewportRef.current) return;
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    };
    
    // Immediate scroll
    doScroll();
    
    // Retry after RAF (DOM layout)
    raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      doScroll();
      
      // Retry again after another RAF
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        doScroll();
        
        // Final retry after short delay for any async content
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          doScroll();
          // Now check if we're at bottom and update state
          const viewport = viewportRef.current;
          if (viewport) {
            const atBottom = computeIsAtBottom(viewport);
            setIsAtBottom(atBottom);
            shouldStickRef.current = atBottom;
            lastSignatureRef.current = tailSignature;
          }
        }, 50);
      });
    });
    
    // Cleanup: cancel pending RAF/timeout on unmount
    return () => {
      cancelled = true;
      if (raf1 !== undefined) cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [viewportReady, hasMessages, computeIsAtBottom, tailSignature]);

  useEffect(() => {
    if (!viewportReady) return;
    const node = viewportRef.current;
    if (!node) return;
    
    const handleScroll = () => {
      const atBottom = computeIsAtBottom(node);
      setIsAtBottom(atBottom);
      shouldStickRef.current = atBottom;
    };
    
    const handlePointerDown = () => {
      shouldStickRef.current = false;
    };
    
    const handleWheel = () => {
      shouldStickRef.current = false;
    };
    
    // Throttle scroll handler to sync with browser paint cycles (~60fps)
    const throttledScroll = throttleRAF(handleScroll);
    
    node.addEventListener("scroll", throttledScroll, { passive: true });
    node.addEventListener("pointerdown", handlePointerDown, { passive: true });
    node.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      node.removeEventListener("scroll", throttledScroll);
      node.removeEventListener("pointerdown", handlePointerDown);
      node.removeEventListener("wheel", handleWheel);
    };
  }, [computeIsAtBottom, viewportReady]);

  useEffect(() => {
    if (!viewportReady) return;
    if (!autoStick) return;
    if (!tailSignature) return;
    if (!hasScrolledForChatRef.current) return;
    if (lastSignatureRef.current === tailSignature) return;
    // Don't auto-scroll during streaming - let user control scroll position
    if (isStreaming) return;
    lastSignatureRef.current = tailSignature;
    syncScrollPosition(false);
  }, [autoStick, tailSignature, syncScrollPosition, isStreaming, viewportReady]);

  useEffect(() => {
    if (tailSignature) return;
    lastSignatureRef.current = null;
  }, [tailSignature]);

  useLayoutEffect(() => {
    if (!autoStick) return;
    if (!viewportReady) return;
    const contentNode = contentRef.current;
    if (!contentNode) return;
    const observer = new ResizeObserver(() => {
      // Prevent infinite loops: skip if already processing a resize
      if (isResizingRef.current) return;
      if (!hasScrolledForChatRef.current) return;
      if (!shouldStickRef.current) return;

      isResizingRef.current = true;
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
        // Reset flag after a short delay to debounce rapid resizes
        setTimeout(() => {
          isResizingRef.current = false;
        }, 100);
      });
    });
    observer.observe(contentNode);
    return () => observer.disconnect();
  }, [autoStick, scrollToBottom, viewportReady]);

  return (
    <div className={cn("relative flex flex-1 min-h-0 flex-col", className)} suppressHydrationWarning>
      <ScrollAreaPrimitive.Root className="relative flex h-full flex-1 min-h-0 overflow-hidden" suppressHydrationWarning>
        <ScrollAreaPrimitive.Viewport
          ref={setViewportRefCallback}
          className="size-full overflow-y-auto overflow-x-hidden"
          aria-label="Conversation messages"
          suppressHydrationWarning
        >
          <div
            ref={contentRef}
            className="flex min-h-full flex-col bg-background/30 px-3 pt-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            data-ph-no-capture
            style={{ paddingBottom }}
            suppressHydrationWarning
          >
            {hasMessages ? (
              <div className="w-full max-w-3xl mx-auto">
                {/* Non-virtualized list - virtualization disabled due to React 19 issues */}
                <div className="flex flex-col gap-4">
                  {messages.map((msg, idx) => (
                    <ChatMessageBubble
                      key={msg.id}
                      message={msg}
                      isLastMessage={idx === messages.length - 1}
                      isStreaming={isStreaming && idx === messages.length - 1}
                      userId={userId}
                    />
                  ))}
                </div>
                {/* Thinking indicator: Show when waiting for response OR streaming but no content yet */}
                {(() => {
                  if (messages.length === 0) return null;
                  const lastMsg = messages[messages.length - 1];
                  // Show if submitted and waiting for assistant response
                  if (isSubmitted && lastMsg?.role === "user") {
                    return (
                      <div className="mt-4">
                        <ProgressiveThinkingIndicator
                          waitState={waitState}
                          elapsedSeconds={elapsedSeconds}
                          modelName={selectedModelName}
                        />
                      </div>
                    );
                  }
                  // Show if streaming started but assistant message has no content yet
                  if (isStreaming && lastMsg?.role === "assistant" && !lastMsg.content?.trim()) {
                    return (
                      <div className="mt-4">
                        <ProgressiveThinkingIndicator
                          waitState={waitState}
                          elapsedSeconds={elapsedSeconds}
                          modelName={selectedModelName}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-4" data-ph-no-capture>
                <div className="flex gap-3 animate-pulse">
                  <div className="size-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/2 rounded bg-muted" />
                  </div>
                </div>
                <div className="flex gap-3 animate-pulse">
                  <div className="size-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="size-4/5 rounded bg-muted" />
                    <div className="h-4 w-1/3 rounded bg-muted" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm" data-ph-no-capture>
                  No messages yet. Say hi!
                </p>
              </div>
            )}
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
      </ScrollAreaPrimitive.Root>
      {/* Scroll to bottom button - shows when not at bottom */}
      {viewportReady && hasMessages && (
        <div
          className={cn(
            "absolute bottom-8 left-1/2 z-30 -translate-x-1/2 transition-all duration-300 ease-out",
            isAtBottom 
              ? "pointer-events-none translate-y-4 scale-90 opacity-0" 
              : "pointer-events-auto translate-y-0 scale-100 opacity-100"
          )}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              shouldStickRef.current = true;
              const node = viewportRef.current;
              if (node) {
                node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
                // Update state after scroll animation
                setTimeout(() => {
                  if (viewportRef.current) {
                    setIsAtBottom(computeIsAtBottom(viewportRef.current));
                  }
                }, 300);
              }
            }}
            aria-label="Scroll to bottom of conversation"
            className="shadow-xl backdrop-blur-md bg-background/90 border border-border hover:bg-background hover:scale-105 active:scale-95 transition-all duration-150 gap-1.5 px-3"
          >
            <ArrowDownIcon className="size-4" />
            <span className="text-xs font-medium">Scroll to bottom</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export const ChatMessagesPanel = memo(ChatMessagesPanelComponent);
ChatMessagesPanel.displayName = "ChatMessagesPanel";

type MessageAttachmentsProps = {
  attachments: Array<{
    storageId: string;
    filename: string;
    contentType: string;
    size: number;
    uploadedAt: number;
    url?: string;
  }>;
  userId?: string | null;
};

const MessageAttachmentItem = ({
  attachment,
  userId: _userId
}: {
  attachment: MessageAttachmentsProps['attachments'][0];
  userId?: string | null;
}) => {
  // PERFORMANCE FIX: Use pre-fetched URL from attachment instead of individual queries
  // URLs are now batch-fetched at the message level in the messages.list query
  // This eliminates the N+1 query pattern (N individual queries for N attachments)
  return (
    <FilePreview
      file={{
        storageId: attachment.storageId,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        url: attachment.url,
      }}
      showRemove={false}
    />
  );
};

const MessageAttachments = memo(({ attachments, userId }: MessageAttachmentsProps) => {
  if (!userId) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <MessageAttachmentItem
          key={attachment.storageId}
          attachment={attachment}
          userId={userId}
        />
      ))}
    </div>
  );
});
MessageAttachments.displayName = "MessageAttachments";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  isLastMessage?: boolean;
  isStreaming?: boolean;
  userId?: string | null;
};

/**
 * Removes attachment placeholder text from message content.
 * Attachment placeholders like "[Attachment: image.png (image/png)]" are meant for AI consumption,
 * not for display. The actual attachments are rendered separately by the FilePreview component.
 */
function stripAttachmentPlaceholders(content: string): string {
  return content.replace(/\[Attachment: [^\]]+\]/g, '').trim();
}

const ChatMessageBubble = memo(
  ({ message, isLastMessage = false, isStreaming = false, userId }: ChatMessageBubbleProps) => {
    const ariaLabel = `${message.role === "assistant" ? "Assistant" : "User"} message`;
    const isUser = message.role === "user";
    const hasParts = message.parts && message.parts.length > 0;

    return (
      <div
        className={cn(
          "flex w-full gap-2 py-4",
          isUser ? "justify-end" : "justify-start"
        )}
        aria-label={ariaLabel}
        role="article"
      >
        {isUser ? (
          <div className="flex flex-col gap-2 max-w-[80%]">
            {(() => {
              // Strip attachment placeholders from content if message has attachments
              const displayContent = message.attachments && message.attachments.length > 0
                ? stripAttachmentPlaceholders(message.content)
                : message.content;

              // Only render content div if there's actual text to display
              return displayContent.length > 0 ? (
                <div
                  className="border border-border rounded-lg px-4 py-2 text-sm whitespace-pre-wrap"
                  data-ph-no-capture
                >
                  {displayContent}
                </div>
              ) : null;
            })()}
            {message.attachments && message.attachments.length > 0 && (
              <MessageAttachments attachments={message.attachments} userId={userId} />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-full">
            {hasParts ? (
              message.parts!.map((part, index) => {
                if (part.type === "reasoning") {
                  // Reasoning is streaming if this is the last message, we're streaming, and this is the last part
                  const isReasoningStreaming = isLastMessage && isStreaming && index === message.parts!.length - 1;
                  // Convert thinkingTimeMs to seconds for the Reasoning component
                  const duration = message.thinkingTimeMs ? Math.ceil(message.thinkingTimeMs / 1000) : undefined;
                  return (
                    <Reasoning
                      key={`${message.id}-reasoning-${index}`}
                      className="w-full"
                      isStreaming={isReasoningStreaming}
                      defaultOpen={isReasoningStreaming}
                      duration={duration}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  );
                }
                return (
                  <SafeStreamdown
                    key={`${message.id}-text-${index}`}
                    className="text-foreground text-sm leading-6 whitespace-pre-wrap max-w-full"
                    data-ph-no-capture
                  >
                    {part.text}
                  </SafeStreamdown>
                );
              })
            ) : (
              <SafeStreamdown
                className="text-foreground text-sm leading-6 whitespace-pre-wrap max-w-full"
                data-ph-no-capture
              >
                {message.content}
              </SafeStreamdown>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    // CRITICAL FIX: Compare parts array to detect reasoning changes
    const sameParts =
      prev.message.parts?.length === next.message.parts?.length &&
      (prev.message.parts?.every((p, i) =>
        p.type === next.message.parts![i]?.type &&
        p.text === next.message.parts![i]?.text
      ) ?? true);

    // Compare attachments
    const sameAttachments =
      prev.message.attachments?.length === next.message.attachments?.length &&
      (prev.message.attachments?.every((a, i) =>
        a.storageId === next.message.attachments![i]?.storageId
      ) ?? true);

    return (
      prev.message.id === next.message.id &&
      prev.message.role === next.message.role &&
      prev.message.content === next.message.content &&
      prev.isStreaming === next.isStreaming &&
      sameParts &&
      sameAttachments
    );
  },
);
ChatMessageBubble.displayName = "ChatMessageBubble";
