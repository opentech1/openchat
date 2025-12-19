/**
 * Composer Skeleton
 *
 * Loading skeleton for the chat composer input area.
 * Matches the actual ChatComposer component structure.
 *
 * @example
 * ```tsx
 * <ComposerSkeleton />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-states";
import { ModelSelectorSkeleton } from "./model-selector-skeleton";

export type ComposerSkeletonProps = {
  /** Whether to show the model selector */
  showModelSelector?: boolean;
  /** Whether to show the file upload button */
  showFileUpload?: boolean;
  /** Additional CSS classes */
  className?: string;
};

export function ComposerSkeleton({
  showModelSelector = true,
  showFileUpload = true,
  className,
}: ComposerSkeletonProps) {
  return (
    <div
      className={cn(
        "relative border border-border bg-card/80 rounded-2xl shadow-xl backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl",
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading composer"
    >
      {/* Textarea area skeleton */}
      <div className="p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between border-t border-border gap-2 p-4">
        {/* Left controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {/* Model selector skeleton */}
          {showModelSelector && <ModelSelectorSkeleton size="md" />}

          {/* File upload button skeleton */}
          {showFileUpload && <Skeleton className="size-9 rounded-md" />}

          {/* Reasoning controls skeleton (sometimes visible) */}
          <Skeleton className="hidden sm:block size-9 rounded-md" />
        </div>

        {/* Send button skeleton */}
        <Skeleton className="size-10 sm:h-10 sm:w-20 rounded-lg" />
      </div>
    </div>
  );
}

ComposerSkeleton.displayName = "ComposerSkeleton";
