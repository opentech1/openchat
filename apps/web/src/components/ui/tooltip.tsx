import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { borderRadius, iconSize } from "@/styles/design-tokens"

/**
 * TooltipProvider - Wraps tooltip components to provide global configuration
 *
 * @param delayDuration - The duration from when the mouse enters a trigger until the tooltip opens (default: 0ms)
 *
 * @accessibility
 * - Provides context for all child tooltip components
 * - Configure delay durations for better UX
 */
function TooltipProvider({
  delayDuration = 0,
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
 * @accessibility
 * - Automatically receives role="tooltip"
 * - Linked to trigger via aria-describedby
 * - Supports aria-label for additional context
 * - Keyboard accessible (Escape to close)
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
  sideOffset = 0,
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
          `bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) ${borderRadius.sm} px-3 py-1.5 text-xs text-balance`,
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className={`bg-primary fill-primary z-50 ${iconSize.xs} translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]`} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
