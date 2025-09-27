"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = ({ className, ...props }: DialogPrimitive.DialogPortalProps & { className?: string }) => (
	<DialogPrimitive.Portal className={cn(className)} {...props} />
);
DialogPortal.displayName = DialogPrimitive.Portal.displayName;

const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
	({ className, ...props }, ref) => (
		<DialogPrimitive.Overlay
			ref={ref}
			className={cn("bg-background/80 fixed inset-0 z-40 backdrop-blur-sm", className)}
			{...props}
		/>
	),
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
	({ className, children, ...props }, ref) => (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				ref={ref}
				className={cn(
					"bg-background text-foreground border-border fixed z-50 grid w-full max-w-lg gap-4 border p-6 shadow-lg duration-200",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:duration-150 data-[state=open]:duration-200",
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					"data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-top-1/2",
					className,
				)}
				{...props}
			>
				{children}
				<DialogPrimitive.Close className="text-muted-foreground hover:text-foreground absolute right-4 top-4 rounded-md p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
					<X className="size-4" />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Content>
		</DialogPortal>
	),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
	({ className, ...props }, ref) => (
		<DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
	),
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
};
