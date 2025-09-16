export type BrandThemeTokens = {
	primary: string;
	primaryForeground: string;
	ring: string;
	chart1: string;
	sidebarPrimary: string;
	sidebarPrimaryForeground: string;
	sidebarRing: string;
};

export type BrandThemeDefinition = {
	readonly id: string;
	readonly label: string;
	readonly previewColor: string;
	readonly previewForeground: string;
	readonly tokens: {
		readonly light: BrandThemeTokens;
		readonly dark: BrandThemeTokens;
	};
};

const BLUE_PRIMARY_LIGHT = "oklch(0.72 0.21 254.624)";
const BLUE_PRIMARY_DARK = "oklch(0.56 0.2 254.624)";
const BLUE_FOREGROUND_LIGHT = "oklch(0.251 0.02 262.5)";
const BLUE_FOREGROUND_DARK = "oklch(0.92 0.012 255.7)";

export const BRAND_THEMES: readonly BrandThemeDefinition[] = [
	{
		id: "blue",
		label: "Blue",
		previewColor: BLUE_PRIMARY_LIGHT,
		previewForeground: BLUE_FOREGROUND_LIGHT,
		tokens: {
			light: {
				primary: BLUE_PRIMARY_LIGHT,
				primaryForeground: BLUE_FOREGROUND_LIGHT,
				ring: BLUE_PRIMARY_LIGHT,
				chart1: BLUE_PRIMARY_LIGHT,
				sidebarPrimary: "oklch(0.68 0.19 254.624)",
				sidebarPrimaryForeground: BLUE_FOREGROUND_LIGHT,
				sidebarRing: BLUE_PRIMARY_LIGHT,
			},
			dark: {
				primary: BLUE_PRIMARY_DARK,
				primaryForeground: BLUE_FOREGROUND_DARK,
				ring: "oklch(0.7 0.2 254.624)",
				chart1: "oklch(0.7 0.2 254.624)",
				sidebarPrimary: "oklch(0.5 0.14 254.624)",
				sidebarPrimaryForeground: BLUE_FOREGROUND_DARK,
				sidebarRing: "oklch(0.7 0.2 254.624)",
			},
		},
	},
	{
		id: "red",
		label: "Red",
		previewColor: "#ef4444",
		previewForeground: "#ffffff",
		tokens: {
			light: {
				primary: "oklch(0.7 0.23 25)",
				primaryForeground: "oklch(0.22 0.03 25)",
				ring: "oklch(0.7 0.23 25)",
				chart1: "oklch(0.7 0.23 25)",
				sidebarPrimary: "oklch(0.66 0.21 25)",
				sidebarPrimaryForeground: "oklch(0.22 0.03 25)",
				sidebarRing: "oklch(0.7 0.23 25)",
			},
			dark: {
				primary: "oklch(0.54 0.24 25)",
				primaryForeground: "oklch(0.96 0.02 25)",
				ring: "oklch(0.62 0.23 25)",
				chart1: "oklch(0.62 0.23 25)",
				sidebarPrimary: "oklch(0.47 0.18 25)",
				sidebarPrimaryForeground: "oklch(0.96 0.02 25)",
				sidebarRing: "oklch(0.62 0.23 25)",
			},
		},
	},
	{
		id: "orange",
		label: "Orange",
		previewColor: "oklch(0.83 0.18 70)",
		previewForeground: "oklch(0.32 0.05 60)",
		tokens: {
			light: {
				primary: "oklch(0.83 0.18 70)",
				primaryForeground: "oklch(0.32 0.05 60)",
				ring: "oklch(0.83 0.18 70)",
				chart1: "oklch(0.83 0.18 70)",
				sidebarPrimary: "oklch(0.79 0.18 70)",
				sidebarPrimaryForeground: "oklch(0.32 0.05 60)",
				sidebarRing: "oklch(0.83 0.18 70)",
			},
			dark: {
				primary: "oklch(0.64 0.18 70)",
				primaryForeground: "oklch(0.94 0.02 80)",
				ring: "oklch(0.74 0.19 70)",
				chart1: "oklch(0.74 0.19 70)",
				sidebarPrimary: "oklch(0.55 0.14 70)",
				sidebarPrimaryForeground: "oklch(0.94 0.02 80)",
				sidebarRing: "oklch(0.74 0.19 70)",
			},
		},
	},
	{
		id: "yellow",
		label: "Yellow",
		previewColor: "oklch(0.93 0.15 100)",
		previewForeground: "oklch(0.34 0.05 98)",
		tokens: {
			light: {
				primary: "oklch(0.93 0.15 100)",
				primaryForeground: "oklch(0.34 0.05 98)",
				ring: "oklch(0.93 0.15 100)",
				chart1: "oklch(0.93 0.15 100)",
				sidebarPrimary: "oklch(0.9 0.15 100)",
				sidebarPrimaryForeground: "oklch(0.33 0.05 95)",
				sidebarRing: "oklch(0.93 0.15 100)",
			},
			dark: {
				primary: "oklch(0.78 0.18 100)",
				primaryForeground: "oklch(0.96 0.02 100)",
				ring: "oklch(0.83 0.18 100)",
				chart1: "oklch(0.83 0.18 100)",
				sidebarPrimary: "oklch(0.64 0.12 100)",
				sidebarPrimaryForeground: "oklch(0.96 0.02 100)",
				sidebarRing: "oklch(0.83 0.18 100)",
			},
		},
	},
	{
		id: "green",
		label: "Green",
		previewColor: "oklch(0.84 0.14 140)",
		previewForeground: "oklch(0.26 0.04 140)",
		tokens: {
			light: {
				primary: "oklch(0.84 0.14 140)",
				primaryForeground: "oklch(0.26 0.04 140)",
				ring: "oklch(0.84 0.14 140)",
				chart1: "oklch(0.84 0.14 140)",
				sidebarPrimary: "oklch(0.8 0.14 140)",
				sidebarPrimaryForeground: "oklch(0.26 0.04 140)",
				sidebarRing: "oklch(0.84 0.14 140)",
			},
			dark: {
				primary: "oklch(0.6 0.18 140)",
				primaryForeground: "oklch(0.95 0.02 145)",
				ring: "oklch(0.68 0.16 140)",
				chart1: "oklch(0.68 0.16 140)",
				sidebarPrimary: "oklch(0.54 0.12 140)",
				sidebarPrimaryForeground: "oklch(0.95 0.02 145)",
				sidebarRing: "oklch(0.68 0.16 140)",
			},
		},
	},
	{
		id: "indigo",
		label: "Indigo",
		previewColor: "oklch(0.64 0.18 278)",
		previewForeground: "oklch(0.24 0.04 278)",
		tokens: {
			light: {
				primary: "oklch(0.64 0.18 278)",
				primaryForeground: "oklch(0.24 0.04 278)",
				ring: "oklch(0.64 0.18 278)",
				chart1: "oklch(0.64 0.18 278)",
				sidebarPrimary: "oklch(0.6 0.17 278)",
				sidebarPrimaryForeground: "oklch(0.24 0.04 278)",
				sidebarRing: "oklch(0.64 0.18 278)",
			},
			dark: {
				primary: "oklch(0.5 0.16 278)",
				primaryForeground: "oklch(0.95 0.01 284)",
				ring: "oklch(0.58 0.17 278)",
				chart1: "oklch(0.58 0.17 278)",
				sidebarPrimary: "oklch(0.44 0.12 278)",
				sidebarPrimaryForeground: "oklch(0.95 0.01 284)",
				sidebarRing: "oklch(0.58 0.17 278)",
			},
		},
	},
	{
		id: "violet",
		label: "Violet",
		previewColor: "oklch(0.68 0.2 320)",
		previewForeground: "oklch(0.26 0.05 320)",
		tokens: {
			light: {
				primary: "oklch(0.68 0.2 320)",
				primaryForeground: "oklch(0.26 0.05 320)",
				ring: "oklch(0.68 0.2 320)",
				chart1: "oklch(0.68 0.2 320)",
				sidebarPrimary: "oklch(0.64 0.19 320)",
				sidebarPrimaryForeground: "oklch(0.26 0.05 320)",
				sidebarRing: "oklch(0.68 0.2 320)",
			},
			dark: {
				primary: "oklch(0.52 0.18 320)",
				primaryForeground: "oklch(0.95 0.02 330)",
				ring: "oklch(0.6 0.19 320)",
				chart1: "oklch(0.6 0.19 320)",
				sidebarPrimary: "oklch(0.46 0.14 320)",
				sidebarPrimaryForeground: "oklch(0.95 0.02 330)",
				sidebarRing: "oklch(0.6 0.19 320)",
			},
		},
	},
] as const;

export type BrandThemeId = (typeof BRAND_THEMES)[number]["id"];

export const DEFAULT_BRAND_THEME: BrandThemeId = BRAND_THEMES[0].id;
