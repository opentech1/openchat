"use client";

import * as React from "react";
import { GitBranch } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getReasoningBadgeText, type ReasoningConfig } from "@/lib/reasoning-config";

export interface ReasoningSettingsButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Current reasoning configuration */
	reasoningConfig: ReasoningConfig;
}

/**
 * ReasoningSettingsButton - A trigger button that shows reasoning status
 *
 * Displays a branching icon with a badge showing the current reasoning level.
 * Used as a trigger for the reasoning settings popover/dialog.
 *
 * This component forwards refs to support Radix UI's asChild pattern.
 */
const ReasoningSettingsButton = React.forwardRef<
	HTMLButtonElement,
	ReasoningSettingsButtonProps
>(({ reasoningConfig, disabled = false, onClick, className, ...props }, ref) => {
	if (!reasoningConfig) return null;

	const isEnabled = reasoningConfig.enabled;
	const badgeLabel = getReasoningBadgeText(reasoningConfig);

	return (
		<Button
			ref={ref}
			type="button"
			variant="outline"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"relative gap-2",
				// Highlight border and background when reasoning is enabled
				isEnabled && "border-primary/50 bg-primary/5",
				className
			)}
			aria-label={`Reasoning settings: ${badgeLabel}`}
			{...props}
		>
			<GitBranch
				className={cn(
					"size-4 shrink-0",
					isEnabled ? "text-primary" : "text-muted-foreground"
				)}
			/>
			<span
				className={cn(
					"text-sm font-medium px-1.5 py-0.5 rounded",
					isEnabled
						? "bg-primary/10 text-primary"
						: "bg-muted text-muted-foreground"
				)}
			>
				{badgeLabel}
			</span>
		</Button>
	);
});

ReasoningSettingsButton.displayName = "ReasoningSettingsButton";

export { ReasoningSettingsButton };
export default ReasoningSettingsButton;
