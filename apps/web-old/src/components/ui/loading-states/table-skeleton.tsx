/**
 * Table Skeleton
 *
 * Loading skeleton for table layouts.
 *
 * @example
 * ```tsx
 * <TableSkeleton rows={5} columns={4} />
 * ```
 */

import { Skeleton } from "./skeleton";

export function TableSkeleton({
	rows = 5,
	columns = 3,
}: {
	rows?: number;
	columns?: number;
}) {
	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex gap-4 border-b pb-2">
				{Array.from({ length: columns }).map((_, i) => (
					<Skeleton key={i} className="h-4 flex-1" />
				))}
			</div>
			{/* Rows */}
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex gap-4">
					{Array.from({ length: columns }).map((_, j) => (
						<Skeleton key={j} className="h-8 flex-1" />
					))}
				</div>
			))}
		</div>
	);
}
