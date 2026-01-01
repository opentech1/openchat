"use client";

import { memo } from "react";
import type { WaitState } from "@/hooks/use-progressive-wait-detection";

type ProgressiveThinkingIndicatorProps = {
	waitState: WaitState;
	elapsedSeconds: number;
	modelName?: string;
};

const ThinkingDots = () => (
	<span className="inline-flex gap-0.5 ml-1">
		<span className="size-1 rounded-full bg-current animate-pulse" />
		<span className="size-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
		<span className="size-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
	</span>
);

/**
 * Simple thinking indicator with animated dots
 */
export const ProgressiveThinkingIndicator = memo(
	({
		waitState,
		elapsedSeconds,
	}: ProgressiveThinkingIndicatorProps) => {
		// Show elapsed time for slow states (>10s)
		const showTime = waitState !== "normal" && elapsedSeconds >= 10;

		return (
			<div className="py-2 text-sm text-muted-foreground inline-flex items-center">
				<span>Thinking</span>
				{showTime ? (
					<span className="text-muted-foreground/70 tabular-nums ml-1">
						({elapsedSeconds}s)
					</span>
				) : (
					<ThinkingDots />
				)}
			</div>
		);
	}
);

ProgressiveThinkingIndicator.displayName = "ProgressiveThinkingIndicator";
