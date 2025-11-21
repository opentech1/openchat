/**
 * Component testing setup utilities
 *
 * This module provides common setup and teardown functionality for component tests.
 * It configures the testing environment with happy-dom and ensures proper cleanup.
 *
 * @module setup-component
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { Window } from "happy-dom";

/**
 * Global cleanup after each test
 * Ensures components are unmounted and DOM is cleaned up
 */
afterEach(() => {
  cleanup();
});

/**
 * Setup happy-dom environment for component testing
 * Creates a virtual DOM window with all necessary globals
 *
 * @returns Window instance for manual cleanup if needed
 *
 * @example
 * ```typescript
 * import { setupDom } from "./setup-component";
 *
 * describe("MyComponent", () => {
 *   let windowInstance: Window;
 *
 *   beforeEach(() => {
 *     windowInstance = setupDom();
 *   });
 *
 *   afterEach(() => {
 *     windowInstance.happyDOM.cancelAsync();
 *     cleanupDom();
 *   });
 * });
 * ```
 */
export function setupDom(): Window {
  const windowInstance = new Window();
  const globalObj = globalThis as unknown as Record<string, unknown>;

  // Setup DOM globals
  globalObj.window = windowInstance as unknown as typeof window;
  globalObj.document = windowInstance.document as typeof document;
  globalObj.navigator = windowInstance.navigator as Navigator;
  globalObj.localStorage = windowInstance.localStorage;
  globalObj.sessionStorage = windowInstance.sessionStorage;
  globalObj.HTMLElement = windowInstance.HTMLElement as typeof HTMLElement;
  globalObj.Node = windowInstance.Node as typeof Node;
  globalObj.customElements = windowInstance.customElements;
  globalObj.Element = windowInstance.Element as typeof Element;
  globalObj.Text = windowInstance.Text as typeof Text;
  globalObj.Comment = windowInstance.Comment as typeof Comment;
  globalObj.DocumentFragment = windowInstance.DocumentFragment as typeof DocumentFragment;

  // Setup event handling
  globalObj.Event = windowInstance.Event as typeof Event;
  globalObj.MouseEvent = windowInstance.MouseEvent as typeof MouseEvent;
  globalObj.KeyboardEvent = windowInstance.KeyboardEvent as typeof KeyboardEvent;
  globalObj.FocusEvent = windowInstance.FocusEvent as typeof FocusEvent;
  globalObj.InputEvent = windowInstance.InputEvent as typeof InputEvent;

  // Setup additional Web APIs
  globalObj.MutationObserver = windowInstance.MutationObserver as typeof MutationObserver;
  globalObj.ResizeObserver = windowInstance.ResizeObserver as typeof ResizeObserver;
  globalObj.IntersectionObserver = windowInstance.IntersectionObserver as typeof IntersectionObserver;

  return windowInstance;
}

/**
 * Cleanup happy-dom globals
 * Removes all global DOM references created by setupDom
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   cleanupDom();
 * });
 * ```
 */
export function cleanupDom(): void {
  const globalObj = globalThis as unknown as Record<string, unknown>;

  delete globalObj.window;
  delete globalObj.document;
  delete globalObj.navigator;
  delete globalObj.localStorage;
  delete globalObj.sessionStorage;
  delete globalObj.HTMLElement;
  delete globalObj.Node;
  delete globalObj.customElements;
  delete globalObj.Element;
  delete globalObj.Text;
  delete globalObj.Comment;
  delete globalObj.DocumentFragment;
  delete globalObj.Event;
  delete globalObj.MouseEvent;
  delete globalObj.KeyboardEvent;
  delete globalObj.FocusEvent;
  delete globalObj.InputEvent;
  delete globalObj.MutationObserver;
  delete globalObj.ResizeObserver;
  delete globalObj.IntersectionObserver;
}

/**
 * Wait for async state updates in tests
 * Useful for waiting for React state updates or async effects
 *
 * @param ms - Milliseconds to wait (default: 0 for next tick)
 * @returns Promise that resolves after the specified time
 *
 * @example
 * ```typescript
 * await waitFor(() => {
 *   expect(screen.getByText("Loaded")).toBeInTheDocument();
 * });
 * ```
 */
export function waitForAsync(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock localStorage for tests
 * Creates an in-memory implementation of Storage API
 *
 * @returns Mock localStorage object
 *
 * @example
 * ```typescript
 * const mockStorage = createMockLocalStorage();
 * mockStorage.setItem("key", "value");
 * expect(mockStorage.getItem("key")).toBe("value");
 * ```
 */
export function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    key(index: number): string | null {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

/**
 * Create a mock implementation of fetch for testing
 * Useful for testing API calls without making actual network requests
 *
 * @param mockResponse - Response data to return
 * @param options - Additional options for the mock
 * @returns Mock fetch function
 *
 * @example
 * ```typescript
 * globalThis.fetch = createMockFetch({ data: "test" });
 * const result = await fetch("/api/test");
 * expect(result.ok).toBe(true);
 * ```
 */
export function createMockFetch(
  mockResponse: unknown,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): typeof fetch {
  return async () => {
    return {
      ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
      status: options.status ?? 200,
      statusText: options.statusText ?? "OK",
      headers: new Headers(options.headers),
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
      blob: async () => new Blob([JSON.stringify(mockResponse)]),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this; },
    } as Response;
  };
}
