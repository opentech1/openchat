"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;

const SheetClose = DialogPrimitive.Close;

const SheetPortal = ({ className, ...props }: DialogPrimitive.DialogPortalProps & { className?: string }) => (
	<DialogPrimitive.Portal className={cn(className)} {...props} />
);
SheetPortal.displayName = DialogPrimitive.Portal.displayName;

const SheetOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
	({ className, ...props }, ref) => (
		<DialogPrimitive.Overlay
			ref={ref}
			className={cn("bg-background/80 fixed inset-0 z-40 backdrop-blur-sm", className)}
			{...props}
		/>
	),
);
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" | "top" | "bottom" }>(
	({ side = "right", className, children, ...props }, ref) => (
		<SheetPortal>
			<SheetOverlay />
			<DialogPrimitive.Content
				ref={ref}
				className={cn(
					"bg-background border-border fixed z-50 flex flex-col border shadow-lg",
					"data-[state=open]:animate-in data-[state=closed]:animate-out",
					"data-[state=closed]:duration-150 data-[state=open]:duration-200",
					side === "right" &&
						"inset-y-0 right-0 h-full w-80 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-96",
					side === "left" &&
						"inset-y-0 left-0 h-full w-80 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:w-96",
					side === "top" &&
						"inset-x-0 top-0 max-h-[85vh] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top border-b",
					side === "bottom" &&
						"inset-x-0 bottom-0 max-h-[85vh] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom border-t",
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
		</SheetPortal>
	),
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("grid gap-1 px-6 py-4", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("mt-auto flex flex-col gap-2 px-6 py-4", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
	({ className, ...props }, ref) => (
		<DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
	),
);
SheetDescription.displayName = DialogPrimitive.Description.displayName;

export {
	Sheet,
	SheetPortal,
	SheetOverlay,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
