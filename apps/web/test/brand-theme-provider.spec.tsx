import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";

import {
	BRAND_THEME_STORAGE_KEY,
	BrandThemeProvider,
	useBrandTheme,
} from "@/components/brand-theme-provider";
import type { BrandThemeId } from "@/lib/brand-themes";

function setupDom() {
	const windowInstance = new Window();
	const globalObj = globalThis as unknown as Record<string, unknown>;
	globalObj.window = windowInstance as unknown as typeof window;
	globalObj.document = windowInstance.document as typeof document;
	globalObj.navigator = windowInstance.navigator as Navigator;
	globalObj.localStorage = windowInstance.localStorage;
	globalObj.HTMLElement = windowInstance.HTMLElement as typeof HTMLElement;
	globalObj.Node = windowInstance.Node as typeof Node;
	globalObj.customElements = windowInstance.customElements;
	return windowInstance;
}

describe("BrandThemeProvider", () => {
	let windowInstance: Window;

	beforeEach(() => {
		windowInstance = setupDom();
	});

	afterEach(() => {
		cleanup();
		windowInstance.happyDOM.cancelAsync();
		const globalObj = globalThis as unknown as Record<string, unknown>;
		delete globalObj.window;
		delete globalObj.document;
		delete globalObj.navigator;
		delete globalObj.localStorage;
		delete globalObj.HTMLElement;
		delete globalObj.Node;
		delete globalObj.customElements;
	});

	it("loads persisted theme and updates document dataset", async () => {
		windowInstance.localStorage.setItem(BRAND_THEME_STORAGE_KEY, "orange");

		function Reader() {
			const { theme } = useBrandTheme();
			return <span data-testid="theme-value">{theme}</span>;
		}

		const { getByTestId } = render(
			<BrandThemeProvider>
				<Reader />
			</BrandThemeProvider>,
		);

		await waitFor(() => {
			expect(getByTestId("theme-value").textContent).toBe("orange");
			expect(windowInstance.document.documentElement.dataset.brandTheme).toBe("orange");
		});
	});

	it("persists selections when setTheme is called", async () => {
		function Updater({ next }: { next: BrandThemeId }) {
			const { theme, setTheme } = useBrandTheme();
			return (
				<button type="button" data-testid="theme-button" data-theme={theme} onClick={() => setTheme(next)}>
					Change theme
				</button>
			);
		}

		const { getByTestId } = render(
			<BrandThemeProvider>
				<Updater next="green" />
			</BrandThemeProvider>,
		);

		const button = getByTestId("theme-button");
		expect(button.getAttribute("data-theme")).toBe("blue");

		fireEvent.click(button);

		await waitFor(() => {
			expect(windowInstance.document.documentElement.dataset.brandTheme).toBe("green");
			expect(windowInstance.localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBe("green");
		});
	});

	it("normalizes legacy chatcn ID to blue", async () => {
		windowInstance.localStorage.setItem(BRAND_THEME_STORAGE_KEY, "chatcn");

		function Reader() {
			const { theme } = useBrandTheme();
			return <span data-testid="theme-value">{theme}</span>;
		}

		const { getByTestId } = render(
			<BrandThemeProvider>
				<Reader />
			</BrandThemeProvider>,
		);

		await waitFor(() => {
			expect(getByTestId("theme-value").textContent).toBe("blue");
			expect(windowInstance.document.documentElement.dataset.brandTheme).toBe("blue");
		});
	});
});
