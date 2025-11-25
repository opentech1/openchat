"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { borderRadius, shadows, spacing } from "@/styles/design-tokens"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			data-slot="popover-content"
			ref={ref}
			align={align}
			sideOffset={sideOffset}
			className={cn(
				`bg-popover text-popover-foreground z-50 w-72 ${borderRadius.lg} border border-border/80 ${spacing.padding.lg} outline-none`,
				"shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
				"focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-2",
				"data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
				"data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
				"duration-100",
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
))

PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
