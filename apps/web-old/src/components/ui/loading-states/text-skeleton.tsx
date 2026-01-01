/**
 * Text Skeleton
 *
 * Loading skeleton for text content with multiple lines.
 *
 * @example
 * ```tsx
 * <TextSkeleton lines={3} />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
	return (
		<div className="space-y-2">
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton
					key={i}
					className={cn(
						"h-4",
						// Last line is shorter
						i === lines - 1 ? "w-2/3" : "w-full",
					)}
				/>
			))}
		</div>
	);
}
