import { useCallback, useRef, type RefObject } from 'react';

/**
 * A smart auto-scroll hook that respects user scroll behavior.
 *
 * This hook provides auto-scroll functionality that automatically scrolls to
 * the bottom of a container (useful for chat interfaces), but intelligently
 * stops auto-scrolling when the user manually scrolls up to read previous content.
 *
 * @param targetRef - A ref to the element that should be scrolled into view
 * @returns An object containing:
 *   - `scrollToBottom`: Function to scroll the target element into view (only if user hasn't manually scrolled)
 *   - `markManualScroll`: Function to call when user manually scrolls (disables auto-scroll)
 *   - `resetManualScroll`: Function to re-enable auto-scroll (e.g., when user scrolls back to bottom)
 *   - `hasManuallyScrolledRef`: Ref indicating whether user has manually scrolled
 *
 * @example
 * ```tsx
 * function ChatMessages() {
 *   const bottomRef = useRef<HTMLDivElement>(null);
 *   const { scrollToBottom, markManualScroll, resetManualScroll } = useOptimizedScroll(bottomRef);
 *
 *   // Scroll to bottom when new messages arrive
 *   useEffect(() => {
 *     scrollToBottom();
 *   }, [messages, scrollToBottom]);
 *
 *   // Detect manual scroll
 *   const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
 *     const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
 *     const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
 *
 *     if (isAtBottom) {
 *       resetManualScroll();
 *     } else {
 *       markManualScroll();
 *     }
 *   };
 *
 *   return (
 *     <div onScroll={handleScroll}>
 *       {messages.map(msg => <Message key={msg.id} {...msg} />)}
 *       <div ref={bottomRef} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useOptimizedScroll(targetRef: RefObject<HTMLElement | null>) {
  const hasManuallyScrolledRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (targetRef.current && !hasManuallyScrolledRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [targetRef]);

  const markManualScroll = useCallback(() => {
    hasManuallyScrolledRef.current = true;
  }, []);

  const resetManualScroll = useCallback(() => {
    hasManuallyScrolledRef.current = false;
  }, []);

  return { scrollToBottom, markManualScroll, resetManualScroll, hasManuallyScrolledRef };
}
