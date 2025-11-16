/**
 * Form Skeleton
 *
 * Loading skeleton for form layouts.
 *
 * @example
 * ```tsx
 * <FormSkeleton fields={3} />
 * ```
 */

import { Skeleton } from "./skeleton";

export function FormSkeleton({ fields = 3 }: { fields?: number }) {
	return (
		<div className="space-y-6">
			{Array.from({ length: fields }).map((_, i) => (
				<div key={i} className="space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
			))}
			<div className="flex gap-3 pt-4">
				<Skeleton className="h-10 w-24" />
				<Skeleton className="h-10 w-24" />
			</div>
		</div>
	);
}
