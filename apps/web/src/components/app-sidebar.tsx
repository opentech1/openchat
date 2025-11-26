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
import { X, PanelLeft, Settings, MessageSquare } from "@/lib/icons";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
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
import { prefetchChat } from "@/lib/chat-prefetch-cache";
import { logError } from "@/lib/logger";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { Logo } from "@/components/logo";
import { ErrorBoundary } from "@/components/error-boundary";
import { LiveRegion } from "@/components/ui/live-region";
import ThemeToggle from "@/components/theme-toggle";

export type ChatListItem = {
  id: string;
  title: string | null;
  updatedAt?: string | Date;
  lastMessageAt?: string | Date | null;
  updatedAtMs?: number | null;
  lastMessageAtMs?: number | null;
  lastActivityMs?: number | null;
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

function upsertChat(list: ChatListItem[], chat: ChatListItem) {
  return dedupeChats(list.concat([chat]));
}

function AppSidebar({ initialChats = [], onNavigate, hideHeader = false, ...sidebarProps }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { theme: brandTheme } = useBrandTheme();
  const { hasKey: hasOpenRouterKey } = useOpenRouterKey();
  const [accountOpen, setAccountOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  // PERFORMANCE FIX: Move dedupeChats to useMemo to avoid recalculation on every render
  const dedupedInitialChats = useMemo(
    () => dedupeChats(initialChats),
    [initialChats],
  );
  const [chats, setChats] = useState<ChatListItem[]>(() => dedupedInitialChats);

  useEffect(() => {
    // Only sync from props if initialChats has actual data
    // When empty, we rely on client-side fetching and don't want to overwrite
    if (dedupedInitialChats.length > 0) {
      setChats(dedupedInitialChats);
    }
  }, [dedupedInitialChats]);

  // CLIENT-SIDE CHAT FETCHING: Load chats from API when initialChats is empty
  // This handles the case where server-side fetching isn't available (e.g., AuthGuard)
  const [isLoadingChats, setIsLoadingChats] = useState(true); // Start as loading
  const [hasFetchedChats, setHasFetchedChats] = useState(false);

  useEffect(() => {
    // Skip if we already have chats from initialChats
    if (initialChats.length > 0) {
      setHasFetchedChats(true);
      setIsLoadingChats(false);
      return;
    }

    // Wait for user session to be available
    if (!user?.id) {
      // Keep loading state while waiting for session
      return;
    }

    // Already fetched, don't fetch again
    if (hasFetchedChats) {
      return;
    }

    const fetchChats = async () => {
      setIsLoadingChats(true);
      try {
        // Load all chats at once (limit=200 is the max)
        const response = await fetch("/api/chats?limit=200", {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.chats && Array.isArray(data.chats)) {
            setChats(dedupeChats(data.chats));
          } else {
            setChats([]);
          }
        } else {
          logError("Failed to fetch chats: HTTP " + response.status);
          setChats([]);
        }
      } catch (error) {
        logError("Failed to fetch chats", error);
        setChats([]);
      } finally {
        setIsLoadingChats(false);
        setHasFetchedChats(true);
      }
    };

    void fetchChats();
  }, [user?.id, initialChats.length, hasFetchedChats]);

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
      setChats((prev) => upsertChat(prev, payload.chat!));
      captureClientEvent("chat.created", {
        chat_id: payload.chat.id,
        title_length: payload.chat.title?.length ?? 0,
        source: "sidebar_button",
        storage_backend: "convex",
      });
      onNavigate?.();
      await router.push(`/dashboard/chat/${payload.chat.id}`);
    } catch (error) {
      logError("Failed to create chat", error);
      // Show actual error message as toast title for better visibility
      const errorMessage = error instanceof Error ? error.message : "Unable to create chat";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, router]);

  const handleDelete = useCallback(async (chatId: string) => {
    setDeletingChatId(chatId);
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
      setChats((prev) => sortChats(prev.filter((chat) => chat.id !== chatId)));
    } catch (error) {
      logError("Failed to delete chat", error);
      // Show actual error message as toast title for better visibility
      const errorMessage = error instanceof Error ? error.message : "Unable to delete chat";
      toast.error(errorMessage);
    } finally {
      setDeletingChatId(null);
    }
  }, []);

  const handleHoverChat = useCallback(
    (chatId: string) => {
      router.prefetch(`/dashboard/chat/${chatId}`);
      void prefetchChat(chatId);
    },
    [router],
  );

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
        ? window.location.pathname || "/dashboard"
        : "/dashboard";
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
              onDelete={handleDelete}
              deletingId={deletingChatId}
              onHoverChat={handleHoverChat}
              isLoading={isLoadingChats}
              onNavigate={onNavigate}
            />
          </ErrorBoundary>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2 space-y-2">
        {/* Settings and Theme Controls */}
        <div className="flex items-stretch gap-2">
          <Link
            href="/dashboard/settings"
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
              <Avatar className="size-9 ring-2 ring-border">
                {user.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={userDisplayLabel || "User"}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {userInitials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {user.name || "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email || "Account Settings"}
                </span>
              </div>
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
        href="/dashboard"
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
  onDelete,
  deletingId,
  onHoverChat,
  isLoading,
  onNavigate,
}: {
  chats: ChatListItem[];
  activePath?: string | null;
  onDelete: (chatId: string) => void | Promise<void>;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
  isLoading?: boolean;
  onNavigate?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hasPrefetchedRef = useRef(false);

  // Proactively prefetch top 5 chats when list loads (helps mobile where no hover)
  useEffect(() => {
    if (hasPrefetchedRef.current || chats.length === 0 || isLoading) return;
    hasPrefetchedRef.current = true;

    // Prefetch top 5 most recent chats in background
    const topChats = chats.slice(0, 5);
    for (const chat of topChats) {
      onHoverChat?.(chat.id);
    }
  }, [chats, isLoading, onHoverChat]);

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
  const virtualListContainerStyle = useMemo(
    () => ({
      height: `${virtualizer.getTotalSize()}px`,
      width: "100%",
      position: "relative" as const,
    }),
    [virtualizer]
  );

  if (isLoading)
    return <p className="px-2 text-xs text-muted-foreground animate-pulse">Loading chats...</p>;

  if (chats.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="rounded-full bg-primary/10 p-3 mb-3">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
        <p className="text-xs text-muted-foreground mb-4">Start a new chat to begin</p>
      </div>
    );

  if (!shouldVirtualize) {
    // Non-virtualized list for few chats
    return (
      <div className="px-1 py-1" data-ph-no-capture>
        {chats.map((c) => (
          <ChatListItem
            key={c.id}
            chat={c}
            activePath={activePath}
            onDelete={onDelete}
            deletingId={deletingId}
            onHoverChat={onHoverChat}
            onNavigate={onNavigate}
          />
        ))}
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
                onDelete={onDelete}
                deletingId={deletingId}
                onHoverChat={onHoverChat}
                onNavigate={onNavigate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatListItem({
  chat,
  activePath,
  onDelete,
  deletingId,
  onHoverChat,
  onNavigate,
}: {
  chat: ChatListItem;
  activePath?: string | null;
  onDelete: (chatId: string) => void | Promise<void>;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
  onNavigate?: () => void;
}) {
  const hrefPath = `/dashboard/chat/${chat.id}`;
  const isActive = activePath === hrefPath;

  return (
    <div className="group relative">
      <Link
        href={`/dashboard/chat/${chat.id}`}
        prefetch
        className={cn(
          // Linear-style: clean active state with left border accent, subtle hover
          "block truncate rounded-md px-3 py-1.5 text-sm transition-colors duration-100 ease-out relative",
          isActive
            ? "bg-accent/50 text-accent-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-r"
            : "hover:bg-accent/50 hover:text-accent-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => onHoverChat?.(chat.id)}
        onFocus={() => onHoverChat?.(chat.id)}
        onClick={() => onNavigate?.()}
      >
        {chat.title || "Untitled"}
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onDelete(chat.id);
        }}
        className={cn(
          // Linear-style: no scale effects, just subtle color transition
          "absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-md",
          "text-muted-foreground/70 transition-colors duration-100 ease-out",
          "hover:bg-destructive/90 hover:text-destructive-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-transparent",
          deletingId === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label="Delete chat"
        disabled={deletingId === chat.id}
      >
        {deletingId === chat.id ? (
          <span className="animate-pulse text-sm">⋯</span>
        ) : (
          <X className="size-3.5" />
        )}
      </button>
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
