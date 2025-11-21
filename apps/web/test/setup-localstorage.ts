/**
 * localStorage polyfill for Node environment
 * Global setup for vitest integration tests
 */

export function setup() {
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
}
