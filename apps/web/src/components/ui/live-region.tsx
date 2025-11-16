"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type LiveRegionProps = {
  /**
   * The message to announce to screen readers
   */
  message: string;

  /**
   * The politeness level for the announcement
   * - "polite": Wait for current speech to finish (default for most loading states)
   * - "assertive": Interrupt current speech (use sparingly, for critical updates)
   */
  politeness?: "polite" | "assertive";

  /**
   * Whether to auto-clear the message after announcement (default: true)
   * This prevents the same message from being re-announced
   */
  autoClear?: boolean;

  /**
   * Delay in milliseconds before clearing the message (default: 1000)
   */
  clearDelay?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
};

/**
 * LiveRegion - ARIA live region component for screen reader announcements
 *
 * This component creates an accessible live region that announces dynamic content
 * changes to screen reader users. It's visually hidden but available to assistive
 * technologies.
 *
 * @example
 * ```tsx
 * // Announce loading state
 * <LiveRegion
 *   message={isLoading ? "Loading messages..." : ""}
 *   politeness="polite"
 * />
 *
 * // Announce critical update
 * <LiveRegion
 *   message={errorMessage}
 *   politeness="assertive"
 * />
 * ```
 */
export function LiveRegion({
  message,
  politeness = "polite",
  autoClear = true,
  clearDelay = 1000,
  className,
}: LiveRegionProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [announcement, setAnnouncement] = React.useState(message);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Update announcement immediately
    setAnnouncement(message);

    // Auto-clear after delay if enabled and message is not empty
    if (autoClear && message) {
      timeoutRef.current = setTimeout(() => {
        setAnnouncement("");
      }, clearDelay);
    }

    // Cleanup on unmount or when message changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [message, autoClear, clearDelay]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className={cn(
        // Screen reader only: visually hidden but accessible
        "sr-only",
        className
      )}
    >
      {announcement}
    </div>
  );
}

LiveRegion.displayName = "LiveRegion";

/**
 * Hook for managing live region announcements programmatically
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { announce, LiveRegionComponent } = useLiveRegion();
 *
 *   const handleAction = () => {
 *     announce("Action completed");
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleAction}>Do something</button>
 *       <LiveRegionComponent />
 *     </>
 *   );
 * }
 * ```
 */
export function useLiveRegion(politeness: "polite" | "assertive" = "polite") {
  const [message, setMessage] = React.useState("");

  const announce = React.useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  const LiveRegionComponent = React.useCallback(
    () => <LiveRegion message={message} politeness={politeness} />,
    [message, politeness]
  );

  return { announce, LiveRegionComponent };
}
