import { useEffect, useState } from "react";

export type WaitState = "normal" | "slow" | "very-slow" | "timeout-warning";

export interface ProgressiveWaitState {
	waitState: WaitState;
	elapsedSeconds: number;
}

/**
 * Hook to detect and categorize long wait times during AI response streaming
 *
 * @param isWaiting - Whether the user is currently waiting for a response
 * @returns Object containing the current wait state and elapsed seconds
 *
 * Wait states:
 * - normal: 0-10 seconds (no special handling)
 * - slow: 10-30 seconds (show elapsed time)
 * - very-slow: 30-60 seconds (show "taking longer than usual" warning)
 * - timeout-warning: 60+ seconds (show timeout warning and suggest actions)
 */
export function useProgressiveWaitDetection(
	isWaiting: boolean
): ProgressiveWaitState {
	const [waitState, setWaitState] = useState<WaitState>("normal");
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	useEffect(() => {
		if (!isWaiting) {
			setWaitState("normal");
			setElapsedSeconds(0);
			return;
		}

		const startTime = Date.now();
		const interval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000);
			setElapsedSeconds(elapsed);

			// Progressive state transitions based on elapsed time
			if (elapsed > 60) {
				setWaitState("timeout-warning"); // > 1 minute
			} else if (elapsed > 30) {
				setWaitState("very-slow"); // > 30 seconds
			} else if (elapsed > 10) {
				setWaitState("slow"); // > 10 seconds
			} else {
				setWaitState("normal");
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [isWaiting]);

	return { waitState, elapsedSeconds };
}
