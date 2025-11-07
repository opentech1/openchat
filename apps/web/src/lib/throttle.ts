/**
 * Throttle utility for performance optimization
 * Ensures a function is called at most once per specified time interval
 */

export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean = false;
	let lastArgs: Parameters<T> | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function throttled(...args: Parameters<T>) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
				// Execute last call if there was one during throttle period
				if (lastArgs !== null && timeoutId === null) {
					timeoutId = setTimeout(() => {
						if (lastArgs !== null) {
							func(...lastArgs);
							lastArgs = null;
						}
						timeoutId = null;
					}, 0);
				}
			}, limit);
		} else {
			// Store the latest args to call after throttle period
			lastArgs = args;
		}
	};
}

/**
 * Creates a throttled version of a function using requestAnimationFrame
 * Ideal for scroll handlers to sync with browser paint cycles (~60fps)
 */
export function throttleRAF<T extends (...args: any[]) => any>(
	func: T
): (...args: Parameters<T>) => void {
	let rafId: number | null = null;
	let lastArgs: Parameters<T> | null = null;

	return function throttled(...args: Parameters<T>) {
		lastArgs = args;
		if (rafId === null) {
			rafId = requestAnimationFrame(() => {
				if (lastArgs !== null) {
					func(...lastArgs);
					lastArgs = null;
				}
				rafId = null;
			});
		}
	};
}
