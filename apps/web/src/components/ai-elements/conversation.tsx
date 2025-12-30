/**
 * Conversation - Simple scroll container for chat messages
 *
 * Provides:
 * - Scrollable message area
 * - Auto-scroll to bottom via ref
 * - Scroll-to-bottom button
 */

'use client'

import { cn } from '@/lib/utils'
import { ArrowDownIcon } from 'lucide-react'
import type { ComponentProps, RefObject } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

// ============================================================================
// Context for scroll state
// ============================================================================

interface ConversationContextValue {
  scrollRef: RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: () => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function useConversationScroll() {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error(
      'useConversationScroll must be used within a Conversation component',
    )
  }
  return context
}

// ============================================================================
// Conversation
// ============================================================================

export type ConversationProps = ComponentProps<'div'>

export const Conversation = ({
  className,
  children,
  ...props
}: ConversationProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = useCallback(() => {
    // Try anchor element first, fallback to direct scroll
    if (anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: 'instant', block: 'end' })
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Track scroll position
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const threshold = 50 // pixels from bottom to consider "at bottom"
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      setIsAtBottom(atBottom)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <ConversationContext.Provider
      value={{ scrollRef, isAtBottom, scrollToBottom }}
    >
      <div
        ref={scrollRef}
        className={cn('relative flex-1 overflow-y-auto', className)}
        role="log"
        {...props}
      >
        {children}
        {/* Anchor element for scroll-to-bottom */}
        <div ref={anchorRef} className="h-0 w-full" aria-hidden="true" />
      </div>
    </ConversationContext.Provider>
  )
}

// ============================================================================
// ConversationContent
// ============================================================================

export type ConversationContentProps = ComponentProps<'div'>

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => (
  <div className={cn('flex flex-col gap-6', className)} {...props}>
    {children}
  </div>
)

// ============================================================================
// ConversationEmptyState
// ============================================================================

export type ConversationEmptyStateProps = ComponentProps<'div'> & {
  title?: string
  description?: string
  icon?: React.ReactNode
}

export const ConversationEmptyState = ({
  className,
  title = 'No messages yet',
  description = 'Start a conversation to see messages here',
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      'flex size-full flex-col items-center justify-center gap-3 p-8 text-center',
      className,
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
)

// ============================================================================
// ConversationScrollButton
// ============================================================================

export type ConversationScrollButtonProps = ComponentProps<'button'>

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationScroll()

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  if (isAtBottom) return null

  return (
    <button
      type="button"
      className={cn(
        'absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg',
        'flex size-9 items-center justify-center',
        'bg-background border border-border',
        'hover:bg-muted transition-colors',
        className,
      )}
      onClick={handleScrollToBottom}
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </button>
  )
}
