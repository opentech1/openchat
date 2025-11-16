/**
 * Avatar Skeleton
 *
 * Loading skeleton for avatar/profile pictures.
 *
 * @example
 * ```tsx
 * <AvatarSkeleton size="sm" />
 * <AvatarSkeleton size="lg" />
 * ```
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export function AvatarSkeleton({
	size = "md",
}: {
	size?: "sm" | "md" | "lg";
}) {
	const sizeClasses = {
		sm: "h-8 w-8",
		md: "h-10 w-10",
		lg: "h-16 w-16",
	};

	return <Skeleton className={cn("rounded-full", sizeClasses[size])} />;
}
