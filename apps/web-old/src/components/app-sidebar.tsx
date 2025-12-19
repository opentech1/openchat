"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, PanelLeft, Settings, MessageSquare, Loader2 } from "@/lib/icons";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  captureClientEvent,
  identifyClient,
  registerClientProperties,
} from "@/lib/posthog";
import { AccountSettingsModalLazy as AccountSettingsModal } from "@/components/lazy/account-settings-modal-lazy";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { useBrandTheme } from "@/components/brand-theme-provider";
import { logError } from "@/lib/logger";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { Logo } from "@/components/logo";
import { ErrorBoundary } from "@/components/error-boundary";
import { LiveRegion } from "@/components/ui/live-region";
import ThemeToggle from "@/components/theme-toggle";
import { useChatList } from "@/contexts/chat-list-context";
import { useChatReadStatus } from "@/hooks/use-chat-read-status";
import { invalidateChatsCache } from "@/lib/cache-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ChatListItem = {
  id: string;
  title: string | null;
  updatedAt?: string | Date;
  lastMessageAt?: string | Date | null;
  updatedAtMs?: number | null;
  lastMessageAtMs?: number | null;
  lastActivityMs?: number | null;
  // Chat status for streaming indicator: "idle" | "streaming"
  status?: string | null;
};

export type AppSidebarProps = {
  initialChats?: ChatListItem[];
  onNavigate?: () => void;
  hideHeader?: boolean;
} & ComponentProps<typeof Sidebar>;

function toDate(value: string | Date | null | undefined) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeChat(chat: ChatListItem): ChatListItem {
  const updatedAt = toDate(chat.updatedAt ?? undefined);
  const lastMessageAt =
    chat.lastMessageAt === null
      ? null
      : (toDate(chat.lastMessageAt ?? undefined) ?? null);
  const updatedAtMs = updatedAt ? updatedAt.getTime() : null;
  const lastMessageAtMs = lastMessageAt ? lastMessageAt.getTime() : null;
  const lastActivityMsRaw = Math.max(
    lastMessageAtMs ?? Number.NEGATIVE_INFINITY,
    updatedAtMs ?? Number.NEGATIVE_INFINITY,
  );
  return {
    ...chat,
    updatedAt,
    lastMessageAt,
    updatedAtMs,
    lastMessageAtMs,
    lastActivityMs:
      lastActivityMsRaw === Number.NEGATIVE_INFINITY ? null : lastActivityMsRaw,
  };
}

function ensureNormalizedChat(chat: ChatListItem): ChatListItem {
  return chat.lastActivityMs != null ? chat : normalizeChat(chat);
}

function mergeChat(
  existing: ChatListItem | undefined,
  incoming: ChatListItem,
): ChatListItem {
  const next = ensureNormalizedChat(incoming);
  if (!existing) return next;
  const current = ensureNormalizedChat(existing);
  const updatedAtMax = Math.max(
    current.updatedAtMs ?? Number.NEGATIVE_INFINITY,
    next.updatedAtMs ?? Number.NEGATIVE_INFINITY,
  );
  const lastMessageAtMax = Math.max(
    current.lastMessageAtMs ?? Number.NEGATIVE_INFINITY,
    next.lastMessageAtMs ?? Number.NEGATIVE_INFINITY,
  );
  const lastActivityMax = Math.max(
    current.lastActivityMs ?? Number.NEGATIVE_INFINITY,
    next.lastActivityMs ?? Number.NEGATIVE_INFINITY,
  );
  return {
    ...current,
    ...next,
    title: next.title ?? current.title ?? null,
    updatedAt:
      updatedAtMax === (next.updatedAtMs ?? Number.NEGATIVE_INFINITY)
        ? next.updatedAt
        : current.updatedAt,
    lastMessageAt:
      lastMessageAtMax === (next.lastMessageAtMs ?? Number.NEGATIVE_INFINITY)
        ? (next.lastMessageAt ?? null)
        : (current.lastMessageAt ?? null),
    updatedAtMs:
      updatedAtMax === Number.NEGATIVE_INFINITY ? null : updatedAtMax,
    lastMessageAtMs:
      lastMessageAtMax === Number.NEGATIVE_INFINITY ? null : lastMessageAtMax,
    lastActivityMs:
      lastActivityMax === Number.NEGATIVE_INFINITY ? null : lastActivityMax,
  };
}

function dedupeChats(list: ChatListItem[]) {
  const map = new Map<string, ChatListItem>();
  for (const chat of list) {
    const normalized = ensureNormalizedChat(chat);
    const existing = map.get(normalized.id);
    map.set(normalized.id, mergeChat(existing, normalized));
  }
  return sortChats(Array.from(map.values()));
}

function AppSidebar({ initialChats = [], onNavigate, hideHeader = false, ...sidebarProps }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const { theme: brandTheme } = useBrandTheme();
  const { hasKey: hasOpenRouterKey } = useOpenRouterKey();
  const [accountOpen, setAccountOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  // Chat pending deletion confirmation (shows the dialog)
  const [chatPendingDelete, setChatPendingDelete] = useState<ChatListItem | null>(null);

  // REAL-TIME CHAT LIST: Use Convex subscription for instant updates
  // This enables:
  // - New chats appearing instantly when created from any page
  // - Streaming indicator in sidebar (shows which chat is actively generating)
  // - Live title updates when chat titles change
  const { chats: realtimeChats, isLoading: realtimeLoading } = useChatList();

  // UNREAD TRACKING: Track when user last viewed each chat
  const { markAsRead, isUnread } = useChatReadStatus();

  // Convert Convex real-time chats to ChatListItem format for the sidebar
  // This is the PRIMARY source of truth for the chat list
  const realtimeChatList = useMemo<ChatListItem[]>(() => {
    return realtimeChats.map(chat => ({
      id: chat._id,
      title: chat.title,
      updatedAt: new Date(chat.updatedAt),
      lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null,
      updatedAtMs: chat.updatedAt,
      lastMessageAtMs: chat.lastMessageAt ?? null,
      lastActivityMs: Math.max(chat.lastMessageAt ?? 0, chat.updatedAt),
      status: chat.status,
    }));
  }, [realtimeChats]);

  // Create a map of chat statuses from real-time data for O(1) lookup
  const realtimeStatusMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const chat of realtimeChats) {
      map.set(chat._id, chat.status);
    }
    return map;
  }, [realtimeChats]);
  
  // Mark current chat as read when viewing it
  useEffect(() => {
    const chatMatch = pathname?.match(/^\/chat\/([^/]+)$/);
    const currentChatId = chatMatch?.[1];
    if (currentChatId) {
      markAsRead(currentChatId);
    }
  }, [pathname, markAsRead]);

  // REAL-TIME CHAT LIST: Use Convex subscription as primary source
  // The realtimeChatList is already sorted by lastActivityMs (most recent first)
  // We sort it here to ensure consistent ordering
  const chats = useMemo(() => {
    // If we have real-time data from Convex, use it (sorted by activity)
    if (realtimeChatList.length > 0) {
      return sortChats(realtimeChatList);
    }
    // Fall back to initialChats during SSR/initial load
    if (initialChats.length > 0) {
      return dedupeChats(initialChats);
    }
    return [];
  }, [realtimeChatList, initialChats]);

  // Loading state: show loading while Convex is fetching and we have no data
  const isLoadingChats = realtimeLoading && chats.length === 0;

  useEffect(() => {
    if (!user?.id) return;
    identifyClient(user.id, {
      workspaceId: user.id,
      properties: { auth_state: "member" },
    });
    registerClientProperties({ auth_state: "member", workspace_id: user.id });
  }, [user?.id]);

  const handleCreateChat = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const response = await fetchWithCsrf("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: "New Chat" }),
      });
      const payload = (await response.json()) as {
        chat?: ChatListItem;
        error?: string;
      };
      if (!response.ok || !payload.chat) {
        throw new Error(payload.error || "Failed to create chat");
      }
      // Convex subscription will auto-update, but also notify other components (mobile nav, etc.)
      invalidateChatsCache();
      captureClientEvent("chat.created", {
        chat_id: payload.chat.id,
        title_length: payload.chat.title?.length ?? 0,
        source: "sidebar_button",
        storage_backend: "convex",
      });
      onNavigate?.();
      await router.push(`/chat/${payload.chat.id}`);
    } catch (error) {
      logError("Failed to create chat", error);
      // Show actual error message as toast title for better visibility
      const errorMessage = error instanceof Error ? error.message : "Unable to create chat";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, router, onNavigate]);

  const handleDelete = useCallback(async (chatId: string) => {
    setDeletingChatId(chatId);

    // Check if we're currently viewing this chat - if so, navigate away immediately
    const isViewingDeletedChat = pathname === `/chat/${chatId}`;
    if (isViewingDeletedChat) {
      // Navigate immediately for instant feedback
      router.push("/");
    }

    try {
      const response = await fetchWithCsrf(`/api/chats/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          (payload as { error?: string }).error || "Failed to delete chat",
        );
      }
      // Convex subscription will auto-update, but also notify other components (mobile nav, etc.)
      invalidateChatsCache();
      toast.success("Chat deleted");
    } catch (error) {
      logError("Failed to delete chat", error);
      // Show actual error message as toast title for better visibility
      const errorMessage = error instanceof Error ? error.message : "Unable to delete chat";
      toast.error(errorMessage);
    } finally {
      setDeletingChatId(null);
    }
  }, [pathname, router]);

  const handleHoverChat = useCallback(
    (chatId: string) => {
      router.prefetch(`/chat/${chatId}`);
    },
    [router],
  );

  // Request deletion - opens confirmation dialog
  const handleRequestDelete = useCallback((chat: ChatListItem) => {
    setChatPendingDelete(chat);
  }, []);

  // Confirm deletion - actually deletes after user confirms
  const handleConfirmDelete = useCallback(() => {
    if (chatPendingDelete) {
      void handleDelete(chatPendingDelete.id);
      setChatPendingDelete(null);
    }
  }, [chatPendingDelete, handleDelete]);

  // Cancel deletion - closes dialog without deleting
  const handleCancelDelete = useCallback(() => {
    setChatPendingDelete(null);
  }, []);

  const userDisplayLabel = useMemo(() => {
    if (!user) return "";
    return user.name || user.email || user.id || "";
  }, [user]);

  const userInitials = useMemo(() => {
    if (!userDisplayLabel) return "";
    const parts = userDisplayLabel.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [userDisplayLabel]);

  const dashboardTrackedRef = useRef(false);
  useEffect(() => {
    if (dashboardTrackedRef.current) return;
    if (!user?.id) return;
    dashboardTrackedRef.current = true;

    registerClientProperties({ has_openrouter_key: hasOpenRouterKey });

    const entryPath =
      typeof window !== "undefined"
        ? window.location.pathname || "/"
        : "/";
    captureClientEvent("dashboard.entered", {
      chat_total: chats.length,
      has_api_key: hasOpenRouterKey,
      entry_path: entryPath,
      brand_theme: brandTheme,
    });
  }, [brandTheme, chats.length, user?.id, hasOpenRouterKey]);

  return (
    <Sidebar {...sidebarProps} className="bg-sidebar">
      {/* Screen reader announcements for loading states */}
      <LiveRegion
        message={isCreating ? "Creating new chat..." : deletingChatId ? "Deleting chat..." : ""}
        politeness="polite"
      />
      {!hideHeader && (
        <SidebarHeader className="px-2 py-3">
          <SidebarHeaderContent />
        </SidebarHeader>
      )}
      <SidebarContent>
        <SidebarGroup className="px-2">
          <Button
            type="button"
            className="w-full justify-start px-3 bg-primary text-primary-foreground font-medium transition-colors duration-100 ease-out hover:bg-primary/90"
            onClick={() => {
              void handleCreateChat();
            }}
            disabled={!user?.id || isCreating}
            aria-label="Create new chat"
            aria-busy={isCreating}
          >
            {isCreating ? "Creating…" : "New Chat"}
          </Button>
        </SidebarGroup>
        <SidebarGroup className="px-2">
          <div className="flex items-center justify-between py-1.5 border-b border-border/[0.08]">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Chats
            </h3>
          </div>
          <ErrorBoundary level="section">
            <ChatList
              chats={chats}
              activePath={pathname}
              onRequestDelete={handleRequestDelete}
              deletingId={deletingChatId}
              onHoverChat={handleHoverChat}
              isLoading={isLoadingChats}
              onNavigate={onNavigate}
              realtimeStatusMap={realtimeStatusMap}
              isUnread={isUnread}
              onCreateChat={handleCreateChat}
              isCreating={isCreating}
            />
          </ErrorBoundary>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2 space-y-2">
        {/* Settings and Theme Controls */}
        <div className="flex items-stretch gap-2">
          <Link
            href="/settings"
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors duration-100 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Settings"
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </Link>
          <ThemeToggleButton />
        </div>

        {/* Account Button */}
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors duration-100 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open account settings"
        >
          {user ? (
            <>
              <Avatar className="size-8 ring-2 ring-border">
                {user.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={userDisplayLabel || "User"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {userInitials || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {user.name?.split(" ")[0] || "User"}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Account</span>
          )}
        </button>
      </div>
      <AccountSettingsModal
        open={accountOpen && Boolean(user)}
        onClose={() => setAccountOpen(false)}
      />
      {/* Delete Chat Confirmation Dialog */}
      <AlertDialog open={chatPendingDelete !== null} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {chatPendingDelete?.title ? (
                <>This will permanently delete &quot;{chatPendingDelete.title}&quot;. This action cannot be undone.</>
              ) : (
                <>This will permanently delete this conversation. This action cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}

AppSidebar.displayName = "AppSidebar";

export default React.memo(AppSidebar);

function SidebarHeaderContent() {
  const { setCollapsed } = useSidebar();

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors duration-100 ease-out"
        aria-label="Collapse sidebar"
        title="Collapse sidebar (Cmd+B)"
      >
        <PanelLeft className="size-4" />
      </button>
      <Link
        href="/"
        className="hover:opacity-80 transition-opacity duration-100 ease-out flex items-center gap-2 px-3 py-1.5 rounded-lg"
      >
        <Logo size="default" />
      </Link>
      <div className="size-9" />
    </div>
  );
}

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 transition-colors duration-100 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ThemeToggle asIcon />
    </button>
  );
}

function ChatList({
  chats,
  activePath,
  onRequestDelete,
  deletingId,
  onHoverChat,
  isLoading,
  onNavigate,
  realtimeStatusMap,
  isUnread,
  onCreateChat,
  isCreating,
}: {
  chats: ChatListItem[];
  activePath?: string | null;
  onRequestDelete: (chat: ChatListItem) => void;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
  isLoading?: boolean;
  onNavigate?: () => void;
  /** Real-time status map from Convex subscription for live streaming indicators */
  realtimeStatusMap?: Map<string, string | undefined>;
  /** Function to check if a chat has unread messages */
  isUnread?: (chatId: string, lastMessageAt: number | null | undefined, isActive: boolean) => boolean;
  /** Function to create a new chat */
  onCreateChat?: () => void | Promise<void>;
  /** Whether a chat is currently being created */
  isCreating?: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Removed proactive prefetching - only prefetch on hover to avoid API spam

  // Only virtualize when we have many chats (>100)
  const shouldVirtualize = chats.length > 100;

  const virtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // Estimated height for each chat item
    overscan: 10, // Render 10 extra items above and below viewport
    enabled: shouldVirtualize,
  });

  // PERFORMANCE FIX: Memoize inline styles for virtualized list
  // NOTE: Use the result of getTotalSize() as dependency, not the function or virtualizer object
  // This prevents infinite re-renders from object reference changes
  const totalSize = virtualizer.getTotalSize();
  const virtualListContainerStyle = useMemo(
    () => ({
      height: `${totalSize}px`,
      width: "100%",
      position: "relative" as const,
    }),
    [totalSize]
  );

  if (isLoading) return null;

  if (chats.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <MessageSquare className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
        <p className="text-xs text-muted-foreground mb-4 max-w-[180px]">
          Start a new chat to begin exploring
        </p>
        {onCreateChat && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void onCreateChat();
            }}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              "New Chat"
            )}
          </Button>
        )}
      </div>
    );

  if (!shouldVirtualize) {
    // Non-virtualized list for few chats
    return (
      <div className="px-1 py-1" data-ph-no-capture>
        {chats.map((c) => {
          const chatPath = `/chat/${c.id}`;
          const isActive = activePath === chatPath;
          const hasUnread = isUnread?.(c.id, c.lastMessageAtMs, isActive) ?? false;
          return (
            <ChatListItem
              key={c.id}
              chat={c}
              activePath={activePath}
              onRequestDelete={onRequestDelete}
              deletingId={deletingId}
              onHoverChat={onHoverChat}
              onNavigate={onNavigate}
              realtimeStatus={realtimeStatusMap?.get(c.id)}
              hasUnread={hasUnread}
            />
          );
        })}
      </div>
    );
  }

  // Virtualized list for many chats - needs its own scroll container
  return (
    <div
      ref={parentRef}
      className="px-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      data-ph-no-capture
    >
      <div style={virtualListContainerStyle}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chat = chats[virtualItem.index];
          if (!chat) return null;
          const chatPath = `/chat/${chat.id}`;
          const isActive = activePath === chatPath;
          const hasUnread = isUnread?.(chat.id, chat.lastMessageAtMs, isActive) ?? false;
          // PERFORMANCE FIX: Create stable style object
          const itemStyle = {
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualItem.start}px)`,
          };
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={itemStyle}
              className="pb-1"
            >
              <ChatListItem
                chat={chat}
                activePath={activePath}
                onRequestDelete={onRequestDelete}
                deletingId={deletingId}
                onHoverChat={onHoverChat}
                onNavigate={onNavigate}
                realtimeStatus={realtimeStatusMap?.get(chat.id)}
                hasUnread={hasUnread}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Streaming indicator - animated pulsing dot for generating state
const StreamingIndicator = () => (
  <span className="relative flex size-2.5 shrink-0">
    {/* Outer pulsing ring */}
    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
    {/* Inner solid dot */}
    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
  </span>
);

// Unread indicator dot - theme-colored, shown when chat has unread messages
const UnreadDot = () => (
  <span className="relative flex size-2 shrink-0">
    <span className="relative inline-flex size-2 rounded-full bg-primary" />
  </span>
);

function ChatListItem({
  chat,
  activePath,
  onRequestDelete,
  deletingId,
  onHoverChat,
  onNavigate,
  realtimeStatus,
  hasUnread,
}: {
  chat: ChatListItem;
  activePath?: string | null;
  onRequestDelete: (chat: ChatListItem) => void;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
  onNavigate?: () => void;
  /** Real-time status from Convex subscription - takes priority over cached status */
  realtimeStatus?: string;
  /** Whether this chat has unread messages */
  hasUnread?: boolean;
}) {
  const hrefPath = `/chat/${chat.id}`;
  const isActive = activePath === hrefPath;
  // Use real-time status from Convex subscription if available, otherwise fall back to cached status
  const effectiveStatus = realtimeStatus ?? chat.status;
  const isStreaming = effectiveStatus === "streaming";
  const isDeleting = deletingId === chat.id;
  // Show unread dot when not hovering, not active, not streaming, not deleting, and has unread messages
  const showUnreadDot = hasUnread && !isActive && !isStreaming && !isDeleting;

  return (
    <div className="group relative">
      <Link
        href={`/chat/${chat.id}`}
        prefetch
        className={cn(
          // Linear-style: clean active state with left border accent, subtle hover
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-100 ease-out relative overflow-hidden pr-8",
          isActive
            ? "bg-accent/50 text-accent-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-r"
            : "hover:bg-accent/50 hover:text-accent-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => onHoverChat?.(chat.id)}
        onFocus={() => onHoverChat?.(chat.id)}
        onClick={() => onNavigate?.()}
      >
        <span className="truncate">{chat.title || "Untitled"}</span>
      </Link>
      {/* Right side: streaming indicator, delete button, or unread dot */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center gap-0.5">
        {isDeleting ? (
          <span className="inline-flex size-6 items-center justify-center">
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          </span>
        ) : (
          <>
            {/* Streaming indicator - visible when chat is streaming */}
            {isStreaming && (
              <span className="inline-flex size-5 items-center justify-center group-hover:hidden transition-opacity duration-150">
                <StreamingIndicator />
              </span>
            )}
            {/* Unread dot - visible when not hovering, not streaming, and has unread messages */}
            {showUnreadDot && !isStreaming && (
              <span className="inline-flex size-6 items-center justify-center group-hover:hidden transition-opacity duration-150">
                <UnreadDot />
              </span>
            )}
            {/* Delete button - visible on hover (even when streaming, so users can stop/delete stuck chats) */}
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRequestDelete(chat);
              }}
              className={cn(
                // Linear-style: no scale effects, just subtle color transition
                "inline-flex size-6 items-center justify-center rounded-md",
                "text-muted-foreground/70 transition-all duration-150 ease-out",
                "hover:bg-destructive/90 hover:text-destructive-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                (showUnreadDot || isStreaming) ? "hidden group-hover:inline-flex" : "opacity-0 group-hover:opacity-100",
              )}
              aria-label="Delete chat"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Memoization cache for sortChats based on content hash
const sortChatsCache = new Map<string, ChatListItem[]>();
const MAX_SORT_CACHE_SIZE = 10;

function generateCacheKey(list: ChatListItem[]): string {
  // Create a stable cache key based on chat IDs and their last activity times
  return list
    .map((chat) => {
      const c = ensureNormalizedChat(chat);
      return `${c.id}:${c.lastActivityMs ?? 0}:${c.updatedAtMs ?? 0}`;
    })
    .sort()
    .join("|");
}

function sortChats(list: ChatListItem[]) {
  // Generate cache key based on content
  const cacheKey = generateCacheKey(list);

  // Check if we have a cached result for this content
  const cached = sortChatsCache.get(cacheKey);
  if (cached) {
    // Move to end (most recently used) for true LRU
    sortChatsCache.delete(cacheKey);
    sortChatsCache.set(cacheKey, cached);
    // Return a shallow copy to prevent mutation of cached data
    return [...cached];
  }

  const copy = list.map(ensureNormalizedChat);
  copy.sort((a, b) => {
    const aLast = a.lastActivityMs ?? 0;
    const bLast = b.lastActivityMs ?? 0;
    if (bLast !== aLast) return bLast - aLast;
    const aUp = a.updatedAtMs ?? 0;
    const bUp = b.updatedAtMs ?? 0;
    if (bUp !== aUp) return bUp - aUp;
    return a.id.localeCompare(b.id);
  });

  // Cache the result with LRU eviction
  if (sortChatsCache.size >= MAX_SORT_CACHE_SIZE) {
    // Remove least recently used entry (first one in the Map)
    const firstKey = sortChatsCache.keys().next().value;
    if (firstKey) sortChatsCache.delete(firstKey);
  }
  sortChatsCache.set(cacheKey, copy);

  return copy;
}
