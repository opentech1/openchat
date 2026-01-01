"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
	React.ElementRef<typeof OTPInput>,
	React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
	<OTPInput
		ref={ref}
		containerClassName={cn(
			"flex items-center gap-2 has-[:disabled]:opacity-50",
			containerClassName,
		)}
		className={cn("disabled:cursor-not-allowed", className)}
		{...props}
	/>
));
InputOTP.displayName = "InputOTP";

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="input-otp-group"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

function InputOTPSlot(
	{
		index,
		className,
		...props
	}: React.ComponentPropsWithoutRef<"div"> & { index: number },
) {
	const inputOTPContext = React.useContext(OTPInputContext);
	const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

	return (
		<div
			data-slot="input-otp-slot"
			data-active={isActive || undefined}
			className={cn(
				"relative flex size-10 items-center justify-center rounded-md border border-input bg-transparent text-base shadow-sm transition-[color,box-shadow,border] md:text-sm",
				"outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				isActive && "z-10",
				className,
			)}
			{...props}
		>
			{char ? (
				<div className="animate-in fade-in-0 zoom-in-95 text-foreground">
					{char}
				</div>
			) : (
				<div className="text-muted-foreground">•</div>
			)}
			{hasFakeCaret && (
				<div className="bg-foreground pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 animate-caret-blink" />
			)}
		</div>
	);
}

function InputOTPSeparator({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="separator"
			aria-hidden="true"
			data-slot="input-otp-separator"
			className={cn("text-muted-foreground select-none px-1", className)}
			{...props}
		>
			—
		</div>
	);
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };

