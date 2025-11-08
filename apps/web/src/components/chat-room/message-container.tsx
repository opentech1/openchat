"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import ChatMessagesFeed from "@/components/chat-messages-feed";

type MessageContainerProps = ComponentProps<typeof ChatMessagesFeed> & {
  composerHeight: number;
};

export function MessageContainer({
  initialMessages,
  optimisticMessages,
  composerHeight,
  loading = false,
  className,
  paddingBottom: _paddingBottom,
  ...rest
}: MessageContainerProps) {
  const conversationPaddingBottom = Math.max(composerHeight + 48, 220);

  return (
    <ChatMessagesFeed
      initialMessages={initialMessages}
      optimisticMessages={optimisticMessages}
      paddingBottom={conversationPaddingBottom}
      className={
        className ??
        "flex-1 rounded-xl bg-background/40 shadow-inner overflow-hidden"
      }
      loading={loading}
      {...rest}
    />
  );
}

export function useComposerHeight() {
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(320);

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

  return { composerRef, composerHeight };
}
