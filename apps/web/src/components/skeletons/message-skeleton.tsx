/**
 * Chat Bubble Skeleton
 *
 * Loading skeleton for individual chat messages that matches the actual
 * ChatMessageBubble component structure. Supports both user and assistant roles.
 *
 * Named "ChatBubbleSkeleton" to avoid collision with ChatMessageSkeleton
 * in ui/loading-states.
 *
 * @example
 * ```tsx
 * <ChatBubbleSkeleton role="user" />
 * <ChatBubbleSkeleton role="assistant" lines={4} />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-states";

export type ChatBubbleSkeletonProps = {
  /** Message role - determines alignment and styling */
  role?: "user" | "assistant";
  /** Number of content lines (1-5) */
  lines?: 1 | 2 | 3 | 4 | 5;
  /** Whether to show attachments placeholder */
  showAttachments?: boolean;
  /** Additional CSS classes */
  className?: string;
};

// Predefined line widths for realistic variation
const lineWidths: Record<number, string[]> = {
  1: ["w-24"],
  2: ["w-full", "w-3/4"],
  3: ["w-full", "w-4/5", "w-1/2"],
  4: ["w-full", "w-full", "w-4/5", "w-2/3"],
  5: ["w-full", "w-full", "w-4/5", "w-3/4", "w-1/3"],
};

export function ChatBubbleSkeleton({
  role = "assistant",
  lines = 3,
  showAttachments = false,
  className,
}: ChatBubbleSkeletonProps) {
  const isUser = role === "user";
  const widths = lineWidths[lines] || lineWidths[3];

  return (
    <div
      className={cn(
        "flex w-full gap-2 py-4",
        isUser ? "justify-end" : "justify-start",
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Loading ${role} message`}
    >
      {isUser ? (
        // User message skeleton - right aligned with border
        <div className="flex flex-col gap-2 max-w-[80%]">
          <div className="border border-border rounded-lg px-4 py-3 space-y-2">
            {widths.map((width, i) => (
              <Skeleton
                key={i}
                className={cn("h-4 rounded", width)}
              />
            ))}
          </div>
          {showAttachments && (
            <div className="flex justify-end">
              <Skeleton className="h-16 w-24 rounded-lg" />
            </div>
          )}
        </div>
      ) : (
        // Assistant message skeleton - left aligned, no border
        <div className="flex flex-col gap-2 max-w-full">
          <div className="space-y-2">
            {widths.map((width, i) => (
              <Skeleton
                key={i}
                className={cn("h-4 rounded", width)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ChatBubbleSkeleton.displayName = "ChatBubbleSkeleton";
