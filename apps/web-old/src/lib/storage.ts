/**
 * Async localStorage wrapper to avoid blocking the main thread
 * All operations are deferred using queueMicrotask
 */

export async function getStorageItem(key: string): Promise<string | null> {
	return new Promise((resolve) => {
		queueMicrotask(() => {
			try {
				if (typeof window === "undefined") {
					resolve(null);
					return;
				}
				const value = window.localStorage.getItem(key);
				resolve(value);
			} catch {
				resolve(null);
			}
		});
	});
}

export async function setStorageItem(key: string, value: string): Promise<void> {
	return new Promise((resolve) => {
		queueMicrotask(() => {
			try {
				if (typeof window !== "undefined") {
					window.localStorage.setItem(key, value);
				}
			} catch {
				// ignore storage failures
			}
			resolve();
		});
	});
}

export async function removeStorageItem(key: string): Promise<void> {
	return new Promise((resolve) => {
		queueMicrotask(() => {
			try {
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(key);
				}
			} catch {
				// ignore storage failures
			}
			resolve();
		});
	});
}

/**
 * Synchronous version with try-catch for cases where async isn't needed
 * These are still safe but may block the main thread briefly
 */
export function getStorageItemSync(key: string): string | null {
	try {
		if (typeof window === "undefined") return null;
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function setStorageItemSync(key: string, value: string): void {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(key, value);
		}
	} catch {
		// ignore storage failures
	}
}

export function removeStorageItemSync(key: string): void {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(key);
		}
	} catch {
		// ignore storage failures
	}
}
