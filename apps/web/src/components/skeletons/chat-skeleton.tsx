/**
 * Chat Skeleton
 *
 * Full chat room loading state including messages area and composer.
 * Matches the actual ChatRoom component structure for seamless transitions.
 *
 * @example
 * ```tsx
 * <ChatSkeleton />
 * <ChatSkeleton messageCount={5} />
 * ```
 */

import { cn } from "@/lib/utils";
import { ChatBubbleSkeleton } from "./message-skeleton";
import { ComposerSkeleton } from "./composer-skeleton";

export type ChatSkeletonProps = {
  /** Number of message skeletons to show (1-6) */
  messageCount?: number;
  /** Whether to show the composer at the bottom */
  showComposer?: boolean;
  /** Additional CSS classes */
  className?: string;
};

// Predefined message patterns for realistic appearance
const messagePatterns: Array<{ role: "user" | "assistant"; lines: 1 | 2 | 3 | 4 | 5 }> = [
  { role: "user", lines: 2 },
  { role: "assistant", lines: 4 },
  { role: "user", lines: 1 },
  { role: "assistant", lines: 5 },
  { role: "user", lines: 2 },
  { role: "assistant", lines: 3 },
];

export function ChatSkeleton({
  messageCount = 4,
  showComposer = true,
  className,
}: ChatSkeletonProps) {
  // Use predefined patterns, cycling if needed
  const messages = Array.from({ length: messageCount }, (_, i) => {
    const pattern = messagePatterns[i % messagePatterns.length];
    return pattern || { role: "assistant" as const, lines: 3 as const };
  });

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col gap-3 overflow-x-hidden px-4",
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading chat"
    >
      {/* Messages area skeleton */}
      <div className="flex-1 rounded-xl bg-background/40 shadow-inner overflow-hidden">
        <div className="w-full max-w-3xl mx-auto px-3 pt-4 pb-48">
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <ChatBubbleSkeleton
                key={i}
                role={msg.role}
                lines={msg.lines}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Composer skeleton - fixed at bottom */}
      {showComposer && (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-30 flex justify-center md:left-[calc(var(--sb-width,0px)+1rem)] md:right-4">
          <div className="w-full max-w-3xl">
            <ComposerSkeleton />
          </div>
        </div>
      )}
    </div>
  );
}

ChatSkeleton.displayName = "ChatSkeleton";
