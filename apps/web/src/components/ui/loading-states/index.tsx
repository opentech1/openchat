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
 *
 * USAGE GUIDELINES:
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

// Base components
export { Skeleton } from "./skeleton";
export { LoadingSpinner } from "./loading-spinner";

// Page-level loading
export { PageLoading } from "./page-loading";

// Layout skeletons
export { CardSkeleton } from "./card-skeleton";
export { ListSkeleton } from "./list-skeleton";
export { ChatMessageSkeleton } from "./chat-message-skeleton";
export { FormSkeleton } from "./form-skeleton";
export { TableSkeleton } from "./table-skeleton";
export { AvatarSkeleton } from "./avatar-skeleton";
export { SidebarSkeleton } from "./sidebar-skeleton";
export { DashboardSkeleton } from "./dashboard-skeleton";
export { TextSkeleton } from "./text-skeleton";
