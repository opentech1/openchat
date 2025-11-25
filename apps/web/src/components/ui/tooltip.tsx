import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { borderRadius, iconSize } from "@/styles/design-tokens"

/**
 * TooltipProvider - Wraps tooltip components to provide global configuration
 *
 * @param delayDuration - The duration from when the mouse enters a trigger until the tooltip opens (default: 400ms for hover intent)
 *
 * @accessibility
 * - Provides context for all child tooltip components
 * - Configure delay durations for better UX
 */
function TooltipProvider({
  delayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/**
 * Tooltip - Root tooltip component
 *
 * @accessibility
 * - Automatically manages ARIA attributes
 * - Supports keyboard navigation (Tab to focus, Escape to close)
 * - Implements WAI-ARIA tooltip pattern
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

/**
 * TooltipTrigger - Element that triggers the tooltip
 *
 * @accessibility
 * - Automatically receives aria-describedby pointing to tooltip content
 * - Should wrap a focusable element for keyboard accessibility
 * - When using asChild, ensure the child is a focusable element (button, link, etc.)
 *
 * @example
 * ```tsx
 * <TooltipTrigger asChild>
 *   <button>Hover or focus me</button>
 * </TooltipTrigger>
 * ```
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * TooltipContent - The tooltip content that appears on trigger interaction
 *
 * Linear-style tooltip with hover intent delay, quick fade-in, and compact styling
 *
 * @accessibility
 * - Automatically receives role="tooltip"
 * - Linked to trigger via aria-describedby
 * - Supports aria-label for additional context
 * - Keyboard accessible (Escape to close)
 * - Automatically flips position if near screen edge
 *
 * @example
 * ```tsx
 * <TooltipContent>
 *   <p>Helpful description</p>
 * </TooltipContent>
 * ```
 */
function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        role="tooltip"
        sideOffset={sideOffset}
        className={cn(
          `bg-primary text-primary-foreground z-50 w-fit ${borderRadius.sm} px-2.5 py-1.5 text-xs text-balance`,
          "shadow-lg shadow-black/10",
          "animate-in fade-in-0 duration-100 ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-75 data-[state=closed]:ease-in",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className={`fill-primary ${iconSize.xs}`} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
