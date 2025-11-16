/**
 * Card Skeleton
 *
 * Loading skeleton for card-based layouts (chats, messages, etc.).
 *
 * @example
 * ```tsx
 * <CardSkeleton />
 * <CardSkeleton showImage />
 * ```
 */

import { Skeleton } from "./skeleton";

export function CardSkeleton({ showImage = false }: { showImage?: boolean }) {
	return (
		<div className="rounded-lg border bg-card p-4 space-y-3">
			{showImage && <Skeleton className="h-48 w-full rounded-md" />}
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<div className="flex gap-2 pt-2">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="h-8 w-16" />
			</div>
		</div>
	);
}
