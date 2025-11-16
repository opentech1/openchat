/**
 * Chat Message Skeleton
 *
 * Loading skeleton for chat messages.
 *
 * @example
 * ```tsx
 * <ChatMessageSkeleton count={3} />
 * ```
 */

import { Skeleton } from "./skeleton";

export function ChatMessageSkeleton({ count = 1 }: { count?: number }) {
	return (
		<div className="space-y-4">
			{Array.from({ length: count }).map((_, i) => (
				<div key={i} className="flex items-start gap-3">
					<Skeleton className="h-8 w-8 rounded-full shrink-0" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-4/5" />
					</div>
				</div>
			))}
		</div>
	);
}
