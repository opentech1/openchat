/**
 * Focus management utilities for accessibility
 */

/**
 * Move focus to the main content area after navigation
 */
export function focusMainContent(): void {
	// Try to find main element with tabIndex=-1
	const main = document.querySelector('main[tabindex="-1"]');
	if (main instanceof HTMLElement) {
		main.focus({ preventScroll: false });
	}
}
