"use client";

import * as React from "react";

import {
  BRAND_THEMES,
  DEFAULT_BRAND_THEME,
  type BrandThemeDefinition,
  type BrandThemeId,
} from "@/lib/brand-themes";

export const BRAND_THEME_STORAGE_KEY = "oc:brand-theme";

const BRAND_THEME_IDS = new Set(BRAND_THEMES.map((theme) => theme.id));

const LEGACY_THEME_MAP: Record<string, BrandThemeId> = {
  chatcn: "blue",
  default: "blue",
};

function normalizeThemeId(
  value: string | null | undefined,
): BrandThemeId | null {
  if (!value) return null;
  const mapped = LEGACY_THEME_MAP[value] ?? value;
  return BRAND_THEME_IDS.has(mapped) ? (mapped as BrandThemeId) : null;
}

function resolveInitialTheme(): BrandThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_BRAND_THEME;
  }
  try {
    const stored = normalizeThemeId(
      window.localStorage.getItem(BRAND_THEME_STORAGE_KEY),
    );
    if (stored) return stored;
  } catch {}
  const attr = normalizeThemeId(
    window.document.documentElement.dataset.brandTheme,
  );
  return attr ?? DEFAULT_BRAND_THEME;
}

type BrandThemeContextValue = {
  readonly theme: BrandThemeId;
  readonly themes: readonly BrandThemeDefinition[];
  readonly setTheme: (value: BrandThemeId) => void;
};

const BrandThemeContext = React.createContext<BrandThemeContextValue | null>(
  null,
);

export function BrandThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = React.useState<BrandThemeId>(() =>
    resolveInitialTheme(),
  );
  const hasLoadedRef = React.useRef(typeof window === "undefined");
  const hasPersistedRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const resolved = resolveInitialTheme();
    hasLoadedRef.current = true;
    setTheme((current) => (current === resolved ? current : resolved));
  }, []);

  React.useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.brandTheme = theme;
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

  return (
    <BrandThemeContext.Provider value={value}>
      {children}
    </BrandThemeContext.Provider>
  );
}

export function useBrandTheme() {
  const context = React.useContext(BrandThemeContext);
  if (!context) {
    // During SSR or dynamic import hydration, context might not be available yet
    // Return a safe default instead of throwing to prevent hydration errors
    if (typeof window === "undefined") {
      // SSR: return default
      return {
        theme: DEFAULT_BRAND_THEME,
        themes: BRAND_THEMES,
        setTheme: () => {},
      } as const;
    }
    // Client-side but outside provider - this shouldn't happen in production
    // but can occur during dynamic imports with ssr: false
    console.warn("useBrandTheme used outside BrandThemeProvider, using default theme");
    return {
      theme: DEFAULT_BRAND_THEME,
      themes: BRAND_THEMES,
      setTheme: () => {},
    } as const;
  }
  return context;
}
