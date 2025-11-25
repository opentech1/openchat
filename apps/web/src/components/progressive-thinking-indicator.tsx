"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { WaitState } from "@/hooks/use-progressive-wait-detection";

type ProgressiveThinkingIndicatorProps = {
	waitState: WaitState;
	elapsedSeconds: number;
	modelName?: string;
};

/**
 * Enhanced thinking indicator that shows progressive feedback based on wait time
 *
 * States:
 * - normal: "Generating response..." (0-10s)
 * - slow: "Generating response (Xs)..." (10-30s)
 * - very-slow: "Processing (Xs)... Taking longer than usual" (30-60s)
 * - timeout-warning: "Still waiting (Xs)... Model may be under high load" (60s+)
 */
export const ProgressiveThinkingIndicator = memo(
	({
		waitState,
		elapsedSeconds,
		modelName,
	}: ProgressiveThinkingIndicatorProps) => {
		const getMessage = () => {
			switch (waitState) {
				case "timeout-warning":
					return {
						text: `Still waiting (${elapsedSeconds}s)... Model may be under high load`,
						color: "text-destructive",
						showCancel: true,
						showProgress: true,
					};
				case "very-slow":
					return {
						text: `Processing (${elapsedSeconds}s)... Taking longer than usual`,
						color: "text-amber-600 dark:text-amber-500",
						showCancel: false,
						showProgress: true,
					};
				case "slow":
					return {
						text: `Generating response (${elapsedSeconds}s)...`,
						color: "text-muted-foreground",
						showCancel: false,
						showProgress: false,
					};
				default:
					return {
						text: modelName
							? `${modelName} is thinking...`
							: "Generating response...",
						color: "text-muted-foreground",
						showCancel: false,
						showProgress: false,
					};
			}
		};

		const { text, color, showCancel, showProgress } = getMessage();

		return (
			<div className="flex flex-col gap-2 py-2 animate-in fade-in duration-200">
				<div className="flex items-center gap-2">
					<div className="flex gap-1">
						<span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
						<span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
						<span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
					</div>
					<span className={cn("text-xs", color)}>{text}</span>
				</div>

				{/* Progressive visual feedback */}
				{showProgress && (
					<div className="w-full max-w-xs">
						<div className="h-1 bg-muted rounded-full overflow-hidden">
							<div
								className={cn(
									"h-full transition-all duration-1000",
									waitState === "timeout-warning"
										? "bg-destructive"
										: waitState === "very-slow"
											? "bg-amber-500"
											: "bg-primary"
								)}
								style={{
									width: `${Math.min((elapsedSeconds / 120) * 100, 100)}%`,
								}}
							/>
						</div>
						<p className="text-[10px] text-muted-foreground mt-1">
							Timeout in {Math.max(120 - elapsedSeconds, 0)}s
						</p>
					</div>
				)}

				{showCancel && (
					<p className="text-xs text-muted-foreground">
						Try a different model or check{" "}
						<a
							href="https://status.openrouter.ai"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-foreground"
						>
							OpenRouter status
						</a>
					</p>
				)}
			</div>
		);
	}
);

ProgressiveThinkingIndicator.displayName = "ProgressiveThinkingIndicator";
