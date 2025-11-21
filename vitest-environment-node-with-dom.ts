/**
 * Custom Vitest environment that extends 'node' with DOM APIs needed by MSW
 * This sets up localStorage before any test code runs
 */

import { builtinEnvironments } from 'vitest/environments';

export default {
	name: 'node-with-dom',
	transformMode: 'ssr' as const,
	async setup() {
		const env = await builtinEnvironments.node.setup();
		
		// Setup localStorage before any test code runs
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
		
		return env;
	},
};
