/**
 * Model Selector Skeleton
 *
 * Loading skeleton for the model selector dropdown button.
 * Matches the actual ModelSelector component structure.
 *
 * @example
 * ```tsx
 * <ModelSelectorSkeleton />
 * <ModelSelectorSkeleton size="sm" />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-states";

export type ModelSelectorSkeletonProps = {
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
};

export function ModelSelectorSkeleton({
  size = "md",
  className,
}: ModelSelectorSkeletonProps) {
  const sizeClasses = {
    sm: "h-8 w-28",
    md: "h-9 w-[140px] sm:w-[200px]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 border border-border bg-background px-3 rounded-md",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading model selector"
    >
      {/* Provider logo skeleton */}
      <Skeleton className="size-4 rounded-sm shrink-0" />
      {/* Model name skeleton */}
      <Skeleton className="h-4 flex-1" />
      {/* Chevron icon skeleton */}
      <Skeleton className="size-4 rounded-sm shrink-0" />
    </div>
  );
}

ModelSelectorSkeleton.displayName = "ModelSelectorSkeleton";
