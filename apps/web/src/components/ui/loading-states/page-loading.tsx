/**
 * Full Page Loading
 *
 * Loading state for entire page/route transitions.
 *
 * @example
 * ```tsx
 * // In loading.tsx
 * export default function Loading() {
 *   return <PageLoading />;
 * }
 * ```
 */

import { LoadingSpinner } from "./loading-spinner";

export function PageLoading({ message }: { message?: string }) {
	return (
		<div
			className="flex h-screen w-full items-center justify-center"
			role="status"
			aria-label="Page loading"
		>
			<div className="flex flex-col items-center gap-4">
				<LoadingSpinner size="lg" />
				{message && (
					<p className="text-sm text-muted-foreground">{message}</p>
				)}
			</div>
		</div>
	);
}
