/**
 * Global polyfills for test environment
 * This MUST be the first setup file to run before any test code or imports
 */

// localStorage polyfill for Node environment (required by MSW)
if (typeof global.localStorage === "undefined") {
	const storage = new Map<string, string>();
	(global as any).localStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => { storage.set(key, value); },
		removeItem: (key: string) => { storage.delete(key); },
		clear: () => { storage.clear(); },
		key: (index: number) => Array.from(storage.keys())[index] ?? null,
		get length() { return storage.size; },
	};
}
