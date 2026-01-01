/**
 * Chat Application Skeleton Components
 *
 * Reusable loading skeletons for the chat application that match
 * the actual component structures for seamless loading transitions.
 *
 * TODO: These skeletons are not yet integrated into the application.
 * Integration is deferred until the chat-room.tsx refactoring is complete.
 * See the chat-room/ directory for the refactoring work in progress.
 *
 * USAGE GUIDELINES:
 *
 * Use these skeletons when:
 * - Initial page/route load
 * - Data fetching for chat, messages, or sidebar
 * - Lazy-loaded component mounting
 *
 * Best practices:
 * - Show skeletons for at least 200-300ms to avoid flashing
 * - Match skeleton structure to actual content layout
 * - Use consistent animation speeds across the app
 *
 * @example
 * ```tsx
 * import { ChatSkeleton, AppSidebarSkeleton, ChatBubbleSkeleton } from "@/components/skeletons";
 *
 * // Full chat loading state
 * if (isLoading) return <ChatSkeleton />;
 *
 * // Individual message skeleton
 * <ChatBubbleSkeleton role="assistant" lines={4} />
 *
 * // Sidebar loading state
 * <AppSidebarSkeleton chatCount={8} />
 * ```
 */

// Chat bubble skeleton - individual chat message loading state
// Named ChatBubbleSkeleton to avoid collision with ChatMessageSkeleton in ui/loading-states
export { ChatBubbleSkeleton, type ChatBubbleSkeletonProps } from "./message-skeleton";

// Chat skeleton - full chat room loading state
export { ChatSkeleton, type ChatSkeletonProps } from "./chat-skeleton";

// App sidebar skeleton - app sidebar loading state
// Named AppSidebarSkeleton to avoid collision with SidebarSkeleton in ui/loading-states
export { AppSidebarSkeleton, type AppSidebarSkeletonProps } from "./sidebar-skeleton";

// Model selector skeleton - dropdown button loading state
export { ModelSelectorSkeleton, type ModelSelectorSkeletonProps } from "./model-selector-skeleton";

// Composer skeleton - chat input area loading state
export { ComposerSkeleton, type ComposerSkeletonProps } from "./composer-skeleton";
