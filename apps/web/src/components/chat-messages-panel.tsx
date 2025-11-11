"use client";

import { ArrowDownIcon } from "lucide-react";
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
import { useVirtualizer } from "@tanstack/react-virtual";

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

type MessagePart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: MessagePart[];
  thinkingTimeMs?: number;
};

type ChatMessagesPanelProps = {
  messages: ChatMessage[];
  paddingBottom: number;
  className?: string;
  loading?: boolean;
  autoStick?: boolean;
  isStreaming?: boolean;
};

const SCROLL_LOCK_THRESHOLD_PX = 48;

function ChatMessagesPanelComponent({
  messages,
  paddingBottom,
  className,
  autoStick = true,
  loading = false,
  isStreaming = false,
}: ChatMessagesPanelProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const initialSyncDoneRef = useRef(false);
  const shouldStickRef = useRef(true);
  const lastSignatureRef = useRef<string | null>(null);

  const hasMessages = messages.length > 0;
  const tailSignature = useMemo(() => {
    if (!hasMessages) return null;
    const last = messages[messages.length - 1]!;
    return `${last.id}:${last.role}:${last.content.length}`;
  }, [hasMessages, messages]);

  // Virtualization setup - only virtualize when we have many messages (>20)
  const shouldVirtualize = messages.length > 20;
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 120, // Estimated height for each message
    overscan: 5, // Render 5 extra items above and below viewport for smooth scrolling
    enabled: shouldVirtualize,
  });

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

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    if (!hasMessages) return;
    if (initialSyncDoneRef.current) return;
    requestAnimationFrame(() => {
      initialSyncDoneRef.current = true;
      shouldStickRef.current = true;
      scrollToBottom("auto");
      setIsAtBottom(true);
      lastSignatureRef.current = tailSignature;
    });
  }, [hasMessages, scrollToBottom, tailSignature]);

  useEffect(() => {
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
    handleScroll();
    node.addEventListener("scroll", throttledScroll, { passive: true });
    node.addEventListener("pointerdown", handlePointerDown, { passive: true });
    node.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      node.removeEventListener("scroll", throttledScroll);
      node.removeEventListener("pointerdown", handlePointerDown);
      node.removeEventListener("wheel", handleWheel);
    };
  }, [computeIsAtBottom]);

  useEffect(() => {
    if (!autoStick) return;
    if (!tailSignature) return;
    if (!initialSyncDoneRef.current) return;
    if (lastSignatureRef.current === tailSignature) return;
    // Don't auto-scroll during streaming - let user control scroll position
    if (isStreaming) return;
    lastSignatureRef.current = tailSignature;
    syncScrollPosition(false);
  }, [autoStick, tailSignature, syncScrollPosition, isStreaming]);

  useEffect(() => {
    if (tailSignature) return;
    lastSignatureRef.current = null;
  }, [tailSignature]);

  useLayoutEffect(() => {
    if (!autoStick) return;
    const contentNode = contentRef.current;
    if (!contentNode) return;
    const observer = new ResizeObserver(() => {
      if (!initialSyncDoneRef.current) return;
      if (!shouldStickRef.current) return;
      scrollToBottom("smooth");
    });
    observer.observe(contentNode);
    return () => observer.disconnect();
  }, [autoStick, scrollToBottom]);

  return (
    <div className={cn("relative flex flex-1 min-h-0 flex-col", className)}>
      <ScrollAreaPrimitive.Root className="relative flex h-full flex-1 min-h-0 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={(node) => {
            viewportRef.current = node;
          }}
          className="size-full"
          aria-label="Conversation messages"
        >
          <div
            ref={contentRef}
            className="flex min-h-full flex-col bg-background/30 px-3 pt-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            tabIndex={0}
            data-ph-no-capture
            style={{ paddingBottom }}
          >
            {hasMessages ? (
              <div className="w-full max-w-3xl mx-auto">
                {shouldVirtualize ? (
                  // Virtualized list for many messages
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: "100%",
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const msg = messages[virtualItem.index];
                      if (!msg) return null;
                      const isLastMsg = virtualItem.index === messages.length - 1;
                      return (
                        <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                          className="pb-4"
                        >
                          <ChatMessageBubble
                            message={msg}
                            isLastMessage={isLastMsg}
                            isStreaming={isStreaming && isLastMsg}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Non-virtualized list for few messages
                  <div className="flex flex-col gap-4">
                    {messages.map((msg, idx) => (
                      <ChatMessageBubble
                        key={msg.id}
                        message={msg}
                        isLastMessage={idx === messages.length - 1}
                        isStreaming={isStreaming && idx === messages.length - 1}
                      />
                    ))}
                  </div>
                )}
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
      {!isAtBottom && hasMessages ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            shouldStickRef.current = true;
            scrollToBottom("smooth");
          }}
          aria-label="Scroll to bottom of conversation"
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 shadow-lg"
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export const ChatMessagesPanel = memo(ChatMessagesPanelComponent);
ChatMessagesPanel.displayName = "ChatMessagesPanel";

type ChatMessageBubbleProps = {
  message: ChatMessage;
  isLastMessage?: boolean;
  isStreaming?: boolean;
};

const ChatMessageBubble = memo(
  ({ message, isLastMessage = false, isStreaming = false }: ChatMessageBubbleProps) => {
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
          <div
            className="border border-border rounded-lg px-4 py-2 text-sm whitespace-pre-wrap max-w-[80%]"
            data-ph-no-capture
          >
            {message.content}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-w-full">
            {hasParts ? (
              message.parts.map((part, index) => {
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

    return (
      prev.message.id === next.message.id &&
      prev.message.role === next.message.role &&
      prev.message.content === next.message.content &&
      prev.isStreaming === next.isStreaming &&
      sameParts
    );
  },
);
ChatMessageBubble.displayName = "ChatMessageBubble";
