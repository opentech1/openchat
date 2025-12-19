/**
 * Sidebar Skeleton
 *
 * Loading skeleton for sidebar navigation.
 *
 * @example
 * ```tsx
 * <SidebarSkeleton items={5} />
 * ```
 */

import { Skeleton } from "./skeleton";

export function SidebarSkeleton({ items = 5 }: { items?: number }) {
	return (
		<div className="space-y-2 p-4">
			<Skeleton className="h-8 w-full mb-6" />
			{Array.from({ length: items }).map((_, i) => (
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	);
}
