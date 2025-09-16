"use client";

import * as React from "react";

import { BRAND_THEMES, DEFAULT_BRAND_THEME, type BrandThemeDefinition, type BrandThemeId } from "@/lib/brand-themes";

export const BRAND_THEME_STORAGE_KEY = "oc:brand-theme";

const BRAND_THEME_IDS = new Set(BRAND_THEMES.map((theme) => theme.id));

const LEGACY_THEME_MAP: Record<string, BrandThemeId> = {
	chatcn: "blue",
	default: "blue",
};

function normalizeThemeId(value: string | null | undefined): BrandThemeId | null {
	if (!value) return null;
	const mapped = LEGACY_THEME_MAP[value] ?? value;
	return BRAND_THEME_IDS.has(mapped) ? (mapped as BrandThemeId) : null;
}

type BrandThemeContextValue = {
	readonly theme: BrandThemeId;
	readonly themes: readonly BrandThemeDefinition[];
	readonly setTheme: (value: BrandThemeId) => void;
};

const BrandThemeContext = React.createContext<BrandThemeContextValue | null>(null);

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = React.useState<BrandThemeId>(DEFAULT_BRAND_THEME);
	const hasLoadedRef = React.useRef(false);
	const hasPersistedRef = React.useRef(false);

	React.useEffect(() => {
		let resolved: BrandThemeId | null = null;
		try {
			const stored = normalizeThemeId(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY));
			if (stored) {
				resolved = stored;
			}
		} catch {}
		if (!resolved) {
			const attr = normalizeThemeId(window.document.documentElement.dataset.brandTheme);
			if (attr) {
				resolved = attr;
			}
		}
		if (resolved) {
			setTheme(resolved);
		}
		hasLoadedRef.current = true;
	}, []);

	React.useEffect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.dataset.brandTheme = theme;
		}
	}, [theme]);

	React.useEffect(() => {
		if (!hasLoadedRef.current) return;
		if (!hasPersistedRef.current) {
			hasPersistedRef.current = true;
			return;
		}
		try {
			window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, theme);
		} catch {}
	}, [theme]);

	const applyTheme = React.useCallback((value: BrandThemeId) => {
		setTheme((current) => (current === value ? current : value));
	}, []);

	const value = React.useMemo<BrandThemeContextValue>(
		() => ({
			theme,
			themes: BRAND_THEMES,
			setTheme: applyTheme,
		}),
		[theme, applyTheme],
	);

	return <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>;
}

export function useBrandTheme() {
	const context = React.useContext(BrandThemeContext);
	if (!context) {
		throw new Error("useBrandTheme must be used within a BrandThemeProvider");
	}
	return context;
}
