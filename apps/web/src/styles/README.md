# Design Tokens

This directory contains centralized design tokens for consistent styling across the application.

## Usage

Import the tokens you need:

```tsx
import { borderRadius, shadows, spacing, patterns } from '@/styles/design-tokens';
import { cn } from '@/lib/utils';

function MyComponent() {
  return (
    <div className={cn(
      borderRadius.md,
      shadows.lg,
      spacing.padding.lg,
      "bg-card"
    )}>
      <div className={cn("flex", spacing.gap.md)}>
        {/* content */}
      </div>
    </div>
  );
}
```

## Available Tokens

### Border Radius

- `borderRadius.none` - No rounding
- `borderRadius.xs` - 2px (subtle rounding)
- `borderRadius.sm` - 4px (buttons, inputs)
- `borderRadius.md` - 8px (cards, modals)
- `borderRadius.lg` - 12px (prominent cards)
- `borderRadius.xl` - 16px (hero sections)
- `borderRadius.2xl` - 24px (special elements)
- `borderRadius.full` - Fully rounded (pills, avatars)
- `borderRadius.inherit` - Inherit from parent

### Shadows

- `shadows.none` - No shadow
- `shadows.2xs` - Subtle depth
- `shadows.xs` - Minimal depth
- `shadows.sm` - Buttons, chips
- `shadows.md` - Cards, dropdowns
- `shadows.lg` - Modals, popovers
- `shadows.xl` - Prominent floating elements
- `shadows.2xl` - Maximum elevation
- `shadows.inner` - Inset effects

### Spacing

All spacing utilities follow Tailwind's 4px scale (1 = 4px).

#### Gap
```tsx
spacing.gap.none   // 0px
spacing.gap.xs     // 4px
spacing.gap.sm     // 8px
spacing.gap.md     // 12px
spacing.gap.lg     // 16px
spacing.gap.xl     // 24px
spacing.gap.2xl    // 32px
spacing.gap.3xl    // 48px
```

#### Padding
```tsx
spacing.padding.none   // 0px
spacing.padding.xs     // 4px
spacing.padding.sm     // 8px
spacing.padding.md     // 12px
spacing.padding.lg     // 16px
spacing.padding.xl     // 24px
spacing.padding.2xl    // 32px
spacing.padding.3xl    // 48px
```

#### Margin
Same scale as padding: `spacing.margin.{size}`

### Typography

```tsx
typography.size.xs      // 12px
typography.size.sm      // 14px
typography.size.md      // 16px (base)
typography.size.lg      // 18px
typography.size.xl      // 20px
typography.size.2xl     // 24px
typography.size.3xl     // 30px
typography.size.4xl     // 36px

typography.weight.normal    // 400
typography.weight.medium    // 500
typography.weight.semibold  // 600
typography.weight.bold      // 700

typography.leading.tight    // Compact line height
typography.leading.normal   // Default line height
typography.leading.relaxed  // Spacious line height
```

### Z-Index

```tsx
zIndex.behind    // z-[-1]
zIndex.base      // z-0
zIndex.raised    // z-10
zIndex.dropdown  // z-20
zIndex.sticky    // z-30
zIndex.fixed     // z-40
zIndex.modal     // z-50
zIndex.top       // z-[100]
```

### Transitions

```tsx
transitions.fast    // 75ms - micro-interactions
transitions.normal  // 150ms - default
transitions.slow    // 300ms - noticeable
transitions.slower  // 500ms - emphasis
```

### Patterns

Pre-composed class combinations for common UI elements:

```tsx
patterns.card          // Standard card styling
patterns.cardHover     // Elevated card (with hover)
patterns.button        // Button base styles
patterns.input         // Input base styles
patterns.backdrop      // Modal backdrop
patterns.focusRing     // Accessible focus ring
```

## Best Practices

1. **Use semantic tokens** - Prefer `borderRadius.md` over `rounded-lg` for better maintainability
2. **Combine with cn()** - Use the `cn()` utility from `@/lib/utils` to merge classes
3. **Stay consistent** - Use the same token values throughout the app
4. **Extend carefully** - If you need a new value, consider if it fits the existing scale first

## Migration Guide

To migrate existing code to use design tokens:

**Before:**
```tsx
<div className="rounded-lg shadow-md p-4 gap-2">
```

**After:**
```tsx
import { borderRadius, shadows, spacing } from '@/styles/design-tokens';

<div className={cn(
  borderRadius.md,
  shadows.md,
  spacing.padding.lg,
  spacing.gap.sm
)}>
```

## Adding New Tokens

If you need to add new design tokens:

1. Consider if the value fits within the existing scale
2. Add it to the appropriate section in `design-tokens.ts`
3. Update this README
4. Use TypeScript types to ensure type safety
