/**
 * Loading Spinner
 *
 * Animated spinner for inline loading states and button actions.
 *
 * @example
 * ```tsx
 * <LoadingSpinner size="sm" />
 * <LoadingSpinner size="lg" className="text-primary" />
 * ```
 */

import { cn } from "@/lib/utils";
import { Loader2 } from "@/lib/icons";

export function LoadingSpinner({
	size = "md",
	className,
}: {
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const sizeClasses = {
		sm: "h-4 w-4",
		md: "h-6 w-6",
		lg: "h-8 w-8",
	};

	return (
		<Loader2
			className={cn("animate-spin", sizeClasses[size], className)}
			aria-label="Loading"
		/>
	);
}
