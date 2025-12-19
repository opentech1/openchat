/**
 * Design Tokens
 *
 * Centralized design system tokens for consistent styling across the application.
 * These tokens map to Tailwind CSS classes and provide semantic naming.
 *
 * Usage:
 * ```tsx
 * import { borderRadius, shadows, spacing } from '@/styles/design-tokens';
 *
 * <div className={borderRadius.md}>...</div>
 * <div className={shadows.lg}>...</div>
 * <div className={cn("flex", spacing.gap.md)}>...</div>
 * ```
 */

/**
 * Border Radius Scale
 *
 * Consistent border radius values across the application.
 * Based on the existing usage patterns in the codebase.
 */
export const borderRadius = {
  /** No border radius (0px) */
  none: "rounded-none",

  /** Extra small radius (2px) - for subtle rounding */
  xs: "rounded-sm",

  /** Small radius (4px) - for buttons, inputs, small cards */
  sm: "rounded-md",

  /** Medium radius (8px) - for cards, modals, default UI elements */
  md: "rounded-lg",

  /** Large radius (12px) - for prominent cards, larger containers */
  lg: "rounded-xl",

  /** Extra large radius (16px) - for hero sections, feature cards */
  xl: "rounded-2xl",

  /** 2XL radius (24px) - for special UI elements */
  "2xl": "rounded-3xl",

  /** Full circle/pill shape (9999px) */
  full: "rounded-full",

  /** Inherit border radius from parent */
  inherit: "rounded-[inherit]",
} as const;

/**
 * Shadow Scale
 *
 * Elevation system for depth and hierarchy.
 * Based on Tailwind's default shadow scale.
 */
export const shadows = {
  /** No shadow */
  none: "shadow-none",

  /** Extra extra small shadow - subtle depth */
  "2xs": "shadow-2xs",

  /** Extra small shadow - minimal depth */
  xs: "shadow-xs",

  /** Small shadow - for buttons, chips */
  sm: "shadow-sm",

  /** Medium shadow - for cards, dropdowns */
  md: "shadow-md",

  /** Large shadow - for modals, popovers */
  lg: "shadow-lg",

  /** Extra large shadow - for prominent floating elements */
  xl: "shadow-xl",

  /** 2XL shadow - for maximum elevation */
  "2xl": "shadow-2xl",

  /** Inner shadow - for inset effects */
  inner: "shadow-inner",
} as const;

/**
 * Spacing Scale
 *
 * Consistent spacing values for gap, padding, and margin.
 * Based on Tailwind's 4px spacing scale (1 = 4px).
 */
export const spacing = {
  /** Gap utilities for flexbox and grid */
  gap: {
    /** 0px */
    none: "gap-0",
    /** 4px */
    xs: "gap-1",
    /** 8px */
    sm: "gap-2",
    /** 12px */
    md: "gap-3",
    /** 16px */
    lg: "gap-4",
    /** 24px */
    xl: "gap-6",
    /** 32px */
    "2xl": "gap-8",
    /** 48px */
    "3xl": "gap-12",
  },

  /** Padding utilities */
  padding: {
    /** 0px */
    none: "p-0",
    /** 4px */
    xs: "p-1",
    /** 8px */
    sm: "p-2",
    /** 12px */
    md: "p-3",
    /** 16px */
    lg: "p-4",
    /** 24px */
    xl: "p-6",
    /** 32px */
    "2xl": "p-8",
    /** 48px */
    "3xl": "p-12",
  },

  /** Margin utilities */
  margin: {
    /** 0px */
    none: "m-0",
    /** 4px */
    xs: "m-1",
    /** 8px */
    sm: "m-2",
    /** 12px */
    md: "m-3",
    /** 16px */
    lg: "m-4",
    /** 24px */
    xl: "m-6",
    /** 32px */
    "2xl": "m-8",
    /** 48px */
    "3xl": "m-12",
  },

  /** Space between utilities (for flex/grid children) */
  space: {
    /** 0px */
    none: "space-x-0 space-y-0",
    /** 4px */
    xs: "space-x-1 space-y-1",
    /** 8px */
    sm: "space-x-2 space-y-2",
    /** 12px */
    md: "space-x-3 space-y-3",
    /** 16px */
    lg: "space-x-4 space-y-4",
    /** 24px */
    xl: "space-x-6 space-y-6",
    /** 32px */
    "2xl": "space-x-8 space-y-8",
    /** 48px */
    "3xl": "space-x-12 space-y-12",
  },
} as const;

/**
 * Typography Scale
 *
 * Consistent text sizing and styling.
 */
export const typography = {
  /** Font sizes */
  size: {
    /** 12px */
    xs: "text-xs",
    /** 14px */
    sm: "text-sm",
    /** 16px - base */
    md: "text-base",
    /** 18px */
    lg: "text-lg",
    /** 20px */
    xl: "text-xl",
    /** 24px */
    "2xl": "text-2xl",
    /** 30px */
    "3xl": "text-3xl",
    /** 36px */
    "4xl": "text-4xl",
  },

  /** Font weights */
  weight: {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  },

  /** Line heights */
  leading: {
    tight: "leading-tight",
    normal: "leading-normal",
    relaxed: "leading-relaxed",
  },
} as const;

/**
 * Z-Index Scale
 *
 * Layering system for overlapping elements.
 */
export const zIndex = {
  /** Behind everything */
  behind: "z-[-1]",
  /** Default layer */
  base: "z-0",
  /** Above base content */
  raised: "z-10",
  /** Dropdowns, tooltips */
  dropdown: "z-20",
  /** Sticky headers */
  sticky: "z-30",
  /** Fixed elements */
  fixed: "z-40",
  /** Modals, overlays */
  modal: "z-50",
  /** Top layer - notifications, toasts */
  top: "z-[100]",
} as const;

/**
 * Transition Durations
 *
 * Standard animation timing for consistency.
 */
export const transitions = {
  /** 75ms - very fast micro-interactions */
  fast: "duration-75",
  /** 100ms - default for most interactions */
  normal: "duration-100",
  /** 200ms - slower, more noticeable transitions */
  slow: "duration-200",
  /** 500ms - for emphasis */
  slower: "duration-500",
} as const;

/**
 * Opacity Scale
 *
 * Consistent opacity values for backgrounds, overlays, and other elements.
 * Use these tokens for semi-transparent backgrounds like cards with backdrop blur.
 */
export const opacity = {
  /** 80% opacity - subtle transparency for lighter elements */
  subtle: "80",

  /** 90% opacity - medium transparency for card backgrounds */
  medium: "90",

  /** 95% opacity - strong transparency for prominent elements */
  strong: "95",

  /** 100% opacity - fully opaque, no transparency */
  opaque: "100",
} as const;

/**
 * Icon Size Scale
 *
 * Consistent sizing for icons across the application.
 * Use the size-* utility for uniform width and height.
 *
 * @example
 * ```tsx
 * import { iconSize } from '@/styles/design-tokens';
 *
 * <CheckIcon className={iconSize.md} />
 * <MenuIcon className={iconSize.sm} />
 * ```
 */
export const iconSize = {
  /** 12px - Extra small icons */
  xs: "size-3",

  /** 16px - Small icons (default for most UI elements) */
  sm: "size-4",

  /** 20px - Medium icons (standard buttons, inputs) */
  md: "size-5",

  /** 24px - Large icons (prominent actions) */
  lg: "size-6",

  /** 32px - Extra large icons (hero sections, empty states) */
  xl: "size-8",
} as const;

/**
 * Responsive Breakpoint Pattern
 *
 * Standard ordering for responsive utilities to maintain consistency.
 * Always apply utilities in this order: base → sm → md → lg → xl
 *
 * @example
 * ```tsx
 * // Correct ordering
 * <div className="flex flex-col gap-2 sm:gap-4 md:flex-row md:gap-6 lg:gap-8">
 *
 * // Incorrect (mixed ordering)
 * <div className="flex md:flex-row gap-2 md:gap-6 sm:gap-4 lg:gap-8">
 * ```
 *
 * Breakpoint reference:
 * - base: < 640px (mobile)
 * - sm: >= 640px (large mobile)
 * - md: >= 768px (tablet)
 * - lg: >= 1024px (desktop)
 * - xl: >= 1280px (large desktop)
 */

/**
 * Common UI Patterns
 *
 * Pre-composed class combinations for common UI elements.
 */
export const patterns = {
  /** Standard card styling */
  card: `${borderRadius.md} ${shadows.sm} bg-card text-card-foreground`,

  /** Elevated card (hover state) */
  cardHover: `${borderRadius.md} ${shadows.md} bg-card text-card-foreground transition-shadow ${transitions.normal}`,

  /** Button base */
  button: `${borderRadius.sm} ${transitions.normal} font-medium`,

  /** Input base */
  input: `${borderRadius.sm} border bg-background ${transitions.normal}`,

  /** Modal/Dialog backdrop */
  backdrop: "fixed inset-0 bg-black/50 backdrop-blur-sm",

  /** Focus ring (accessible) */
  focusRing: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
} as const;

/**
 * Type exports for TypeScript support
 */
export type BorderRadius = keyof typeof borderRadius;
export type Shadow = keyof typeof shadows;
export type Spacing = keyof typeof spacing.gap;
export type Typography = keyof typeof typography.size;
export type ZIndex = keyof typeof zIndex;
export type Transition = keyof typeof transitions;
export type Opacity = keyof typeof opacity;
export type IconSize = keyof typeof iconSize;
