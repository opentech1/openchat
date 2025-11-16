/**
 * List Skeleton
 *
 * Loading skeleton for list views (chat list, message list, etc.).
 *
 * @example
 * ```tsx
 * <ListSkeleton items={5} />
 * <ListSkeleton items={3} showAvatar />
 * ```
 */

import { Skeleton } from "./skeleton";

export function ListSkeleton({
	items = 3,
	showAvatar = false,
}: {
	items?: number;
	showAvatar?: boolean;
}) {
	return (
		<div className="space-y-3">
			{Array.from({ length: items }).map((_, i) => (
				<div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
					{showAvatar && (
						<Skeleton className="h-10 w-10 rounded-full shrink-0" />
					)}
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				</div>
			))}
		</div>
	);
}
