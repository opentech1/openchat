"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"

const Command = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn(
			"bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60",
			className,
		)}
		{...props}
	/>
))
Command.displayName = CommandPrimitive.displayName

const CommandInput = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Input>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div className="border-border flex items-center border-b px-3 py-2">
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				"bg-transparent placeholder:text-muted-foreground flex-1 text-sm outline-none",
				className,
			)}
			{...props}
		/>
	</div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn("flex-1 overflow-y-auto p-2", className)}
		{...props}
	/>
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Empty>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Empty
		ref={ref}
		className={cn("text-muted-foreground py-6 text-center text-sm", className)}
		{...props}
	/>
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Group>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn("text-muted-foreground/70 overflow-hidden p-1", className)}
		{...props}
	/>
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandItem = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"text-foreground data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary flex w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
			className,
		)}
		{...props}
	/>
))
CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandSeparator = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Separator
		ref={ref}
		className={cn("-mx-1 my-2 h-px bg-border", className)}
		{...props}
	/>
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
	<span
		className={cn("font-mono text-xs text-muted-foreground ml-auto", className)}
		{...props}
	/>
)
CommandShortcut.displayName = "CommandShortcut"

export {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
}
