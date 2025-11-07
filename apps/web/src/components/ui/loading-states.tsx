/**
 * Loading State Components
 *
 * Standardized loading skeletons for consistent UX across the application.
 *
 * DESIGN PRINCIPLES:
 * - Use skeletons instead of spinners for better perceived performance
 * - Match skeleton structure to actual content layout
 * - Animate skeletons for visual feedback
 * - Keep skeletons simple and uncluttered
 *
 * WHEN TO USE SKELETONS:
 * - Initial page load
 * - Data fetching (lists, cards, forms)
 * - Lazy-loaded components
 * - Image loading
 *
 * WHEN TO USE SPINNERS:
 * - Button actions (submit, save, delete)
 * - Short operations (< 1 second)
 * - Inline loading states
 * - Modal/dialog operations
 *
 * ACCESSIBILITY:
 * - All loading states have aria-label or aria-busy
 * - Screen readers announce "Loading..." state
 * - Avoid flashing content by showing skeleton for minimum duration
 */

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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

/**
 * Card Skeleton
 *
 * Loading skeleton for card-based layouts (chats, messages, etc.).
 *
 * @example
 * ```tsx
 * <CardSkeleton />
 * <CardSkeleton showImage />
 * ```
 */
export function CardSkeleton({ showImage = false }: { showImage?: boolean }) {
	return (
		<div className="rounded-lg border bg-card p-4 space-y-3">
			{showImage && <Skeleton className="h-48 w-full rounded-md" />}
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/2" />
			<div className="flex gap-2 pt-2">
				<Skeleton className="h-8 w-16" />
				<Skeleton className="h-8 w-16" />
			</div>
		</div>
	);
}

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

/**
 * Sidebar Skeleton
 *
 * Loading skeleton for sidebar navigation.
 *
 * @example
 * ```tsx
 * <SidebarSkeleton items={5} />
 * ```
 */
export function SidebarSkeleton({ items = 5 }: { items?: number }) {
	return (
		<div className="space-y-2 p-4">
			<Skeleton className="h-8 w-full mb-6" />
			{Array.from({ length: items }).map((_, i) => (
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	);
}

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

/**
 * Usage Guidelines
 *
 * BEST PRACTICES:
 * 1. Match the skeleton to your content structure
 * 2. Show skeletons for at least 300ms to avoid flashing
 * 3. Use consistent animation speeds
 * 4. Don't show too many skeletons at once (max 10-15 items)
 * 5. Consider skeleton quality vs. loading time trade-off
 *
 * ANTI-PATTERNS:
 * - Don't use spinners for list/card loading (use skeletons)
 * - Don't show skeleton AND spinner simultaneously
 * - Don't make skeletons too detailed (keep them simple)
 * - Don't forget aria labels for accessibility
 *
 * WHEN TO SHOW:
 * - Initial load: Show skeleton immediately
 * - Refetch: Show skeleton if > 300ms
 * - Background refresh: Don't show skeleton, update in place
 * - Pagination: Show skeleton for new page
 *
 * TESTING:
 * - Test with slow network (Chrome DevTools Network throttling)
 * - Test with screen reader to verify announcements
 * - Test that skeletons match actual content layout
 */
