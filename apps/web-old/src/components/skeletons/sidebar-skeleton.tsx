/**
 * App Sidebar Skeleton
 *
 * Loading skeleton for the app sidebar with user avatar, chat list,
 * and controls. Matches the actual AppSidebar component structure.
 *
 * Named "AppSidebarSkeleton" to avoid collision with the generic
 * SidebarSkeleton in ui/loading-states.
 *
 * @example
 * ```tsx
 * <AppSidebarSkeleton />
 * <AppSidebarSkeleton chatCount={8} />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/loading-states";

export type AppSidebarSkeletonProps = {
  /** Number of chat list items to show */
  chatCount?: number;
  /** Whether to show the header with logo */
  showHeader?: boolean;
  /** Whether to show the user account section */
  showAccount?: boolean;
  /** Additional CSS classes */
  className?: string;
};

export function AppSidebarSkeleton({
  chatCount = 6,
  showHeader = true,
  showAccount = true,
  className,
}: AppSidebarSkeletonProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col bg-sidebar",
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading sidebar"
    >
      {/* Header skeleton */}
      {showHeader && (
        <div className="px-2 py-3">
          <div className="flex items-center justify-between">
            {/* Collapse button skeleton */}
            <Skeleton className="size-9 rounded-md" />
            {/* Logo skeleton */}
            <Skeleton className="h-8 w-24 rounded-lg" />
            {/* Spacer */}
            <div className="size-9" />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {/* New chat button skeleton */}
        <div className="px-2 py-2">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Chats header */}
        <div className="px-2 py-1.5">
          <div className="flex items-center justify-between border-b border-border/[0.08] pb-1.5">
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Chat list skeleton */}
        <div className="px-3 py-1 space-y-1">
          {Array.from({ length: chatCount }).map((_, i) => (
            <ChatListItemSkeleton key={i} index={i} />
          ))}
        </div>
      </div>

      {/* Footer section */}
      <div className="mt-auto w-full px-2 pb-3 pt-2 space-y-2">
        {/* Settings and theme row */}
        <div className="flex items-stretch gap-2">
          {/* Settings button skeleton */}
          <Skeleton className="flex-1 h-10 rounded-lg" />
          {/* Theme toggle skeleton */}
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>

        {/* Account button skeleton */}
        {showAccount && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        )}
      </div>
    </div>
  );
}

AppSidebarSkeleton.displayName = "AppSidebarSkeleton";

// Individual chat list item skeleton
function ChatListItemSkeleton({ index }: { index: number }) {
  // Vary width for realistic appearance
  const widths = ["w-3/4", "w-full", "w-4/5", "w-2/3", "w-5/6", "w-1/2"];
  const width = widths[index % widths.length] || "w-3/4";

  return (
    <div className="flex items-center gap-2 rounded-md px-3 py-1.5">
      <Skeleton className={cn("h-4", width)} />
    </div>
  );
}
