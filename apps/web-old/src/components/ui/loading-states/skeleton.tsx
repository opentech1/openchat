/**
 * Base Skeleton Component
 *
 * Building block for all skeleton states. Use this to create custom
 * skeleton layouts that match your content structure.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-full" />
 * <Skeleton className="h-32 w-64 rounded-lg" />
 * ```
 */

import { cn } from "@/lib/utils";

export function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"animate-pulse rounded-md bg-muted",
				className,
			)}
			aria-busy="true"
			aria-label="Loading"
			{...props}
		/>
	);
}
