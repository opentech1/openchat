/**
 * Focus management utilities for accessibility
 */

/**
 * Store the currently focused element before navigation or modal open
 */
export function storeFocusedElement(): HTMLElement | null {
	const active = document.activeElement;
	if (active instanceof HTMLElement) {
		return active;
	}
	return null;
}

/**
 * Restore focus to a previously focused element
 */
export function restoreFocus(element: HTMLElement | null): void {
	if (element && document.body.contains(element)) {
		element.focus({ preventScroll: true });
	}
}

/**
 * Move focus to the main content area after navigation
 */
export function focusMainContent(): void {
	// Try to find main element or fall back to body
	const main = document.querySelector('main');
	if (main instanceof HTMLElement && main.tabIndex === -1) {
		main.focus({ preventScroll: false });
	} else if (main instanceof HTMLElement) {
		// Set tabIndex temporarily to make it focusable
		main.tabIndex = -1;
		main.focus({ preventScroll: false });
		// Remove tabIndex after focus
		setTimeout(() => {
			main.removeAttribute('tabindex');
		}, 0);
	}
}

/**
 * Announce content to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
	const announcement = document.createElement('div');
	announcement.setAttribute('role', 'status');
	announcement.setAttribute('aria-live', priority);
	announcement.setAttribute('aria-atomic', 'true');
	announcement.className = 'sr-only';
	announcement.textContent = message;
	
	document.body.appendChild(announcement);
	
	// Remove after announcement
	setTimeout(() => {
		document.body.removeChild(announcement);
	}, 1000);
}
