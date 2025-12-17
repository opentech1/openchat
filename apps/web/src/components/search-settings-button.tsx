"use client";

import * as React from "react";
import { WebSearchIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSearchBadgeText, type SearchConfig } from "@/lib/search-config";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface SearchSettingsButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Current search configuration */
	searchConfig: SearchConfig;
	/** Callback when button is clicked */
	onToggle?: () => void;
}

/**
 * SearchSettingsButton - A toggle button that enables/disables web search
 *
 * Displays a web/globe icon with a badge showing ON/OFF status.
 * Click to toggle web search functionality.
 */
const SearchSettingsButton = React.forwardRef<
	HTMLButtonElement,
	SearchSettingsButtonProps
>(({ searchConfig, disabled = false, onToggle, className, ...props }, ref) => {
	if (!searchConfig) return null;

	const isEnabled = searchConfig.enabled;
	const badgeLabel = getSearchBadgeText(searchConfig);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					ref={ref}
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={onToggle}
					className={cn(
						"relative gap-2",
						// Highlight border and background when search is enabled
						isEnabled && "border-primary/50 bg-primary/5",
						className
					)}
					aria-label={`Web Search: ${badgeLabel}`}
					aria-pressed={isEnabled}
					{...props}
				>
					<WebSearchIcon
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
			</TooltipTrigger>
			<TooltipContent>
				<p>Web Search</p>
			</TooltipContent>
		</Tooltip>
	);
});

SearchSettingsButton.displayName = "SearchSettingsButton";

export { SearchSettingsButton };
export default SearchSettingsButton;
