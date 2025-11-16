/**
 * Dashboard Skeleton
 *
 * Loading skeleton for dashboard layouts with stats and charts.
 *
 * @example
 * ```tsx
 * <DashboardSkeleton />
 * ```
 */

import { Skeleton } from "./skeleton";
import { TableSkeleton } from "./table-skeleton";

export function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Stats Row */}
			<div className="grid gap-4 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="rounded-lg border bg-card p-6 space-y-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-16" />
						<Skeleton className="h-3 w-32" />
					</div>
				))}
			</div>
			{/* Chart */}
			<div className="rounded-lg border bg-card p-6">
				<Skeleton className="h-6 w-32 mb-4" />
				<Skeleton className="h-64 w-full" />
			</div>
			{/* Table */}
			<div className="rounded-lg border bg-card p-6">
				<Skeleton className="h-6 w-40 mb-4" />
				<TableSkeleton rows={5} columns={4} />
			</div>
		</div>
	);
}
