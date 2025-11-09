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
import { X } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  captureClientEvent,
  identifyClient,
  registerClientProperties,
} from "@/lib/posthog";
import { AccountSettingsModalLazy as AccountSettingsModal } from "@/components/lazy/account-settings-modal-lazy";
import { loadOpenRouterKey } from "@/lib/openrouter-key-storage";
import { useBrandTheme } from "@/components/brand-theme-provider";
import { prefetchChat } from "@/lib/chat-prefetch-cache";
import { logError } from "@/lib/logger";
import { fetchWithCsrf } from "@/lib/csrf-client";

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

function AppSidebar({ initialChats = [], ...sidebarProps }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { theme: brandTheme } = useBrandTheme();
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
    setChats(dedupedInitialChats);
  }, [dedupedInitialChats]);

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
      await router.push(`/dashboard/chat/${payload.chat.id}`);
    } catch (error) {
      logError("Failed to create chat", error);
      toast.error("Unable to create chat", {
        description:
          error instanceof Error ? error.message : "Try again in a moment",
      });
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
      toast.error("Unable to delete chat", {
        description: error instanceof Error ? error.message : "Please retry",
      });
    } finally {
      setDeletingChatId(null);
    }
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
    void (async () => {
      let hasKey = false;
      try {
        const key = await loadOpenRouterKey();
        hasKey = Boolean(key);
        registerClientProperties({ has_openrouter_key: hasKey });
      } catch {
        hasKey = false;
      }
      const entryPath =
        typeof window !== "undefined"
          ? window.location.pathname || "/dashboard"
          : "/dashboard";
      captureClientEvent("dashboard.entered", {
        chat_total: chats.length,
        has_api_key: hasKey,
        entry_path: entryPath,
        brand_theme: brandTheme,
      });
    })();
  }, [brandTheme, chats.length, user?.id]);

  return (
    <Sidebar defaultCollapsed {...sidebarProps}>
      <SidebarHeader className="px-2 py-3">
        <div className="flex items-center justify-center">
          <Link
            href="/dashboard"
            className={cn(
              "select-none text-lg font-semibold tracking-tight md:text-xl leading-none text-white",
            )}
          >
            OpenChat
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center"
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
        <SidebarGroup>
          <div className="flex items-center justify-between px-2 py-1.5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Chats
            </h3>
          </div>
          <ChatList
            chats={chats}
            activePath={pathname}
            onDelete={handleDelete}
            deletingId={deletingChatId}
            onHoverChat={(chatId) => {
              router.prefetch(`/dashboard/chat/${chatId}`);
              void prefetchChat(chatId);
            }}
          />
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2">
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition"
          aria-label="Open account settings"
        >
          <span className="text-xs text-muted-foreground">Account</span>
          {user ? (
            <Avatar className="size-8">
              {user.image ? (
                <AvatarImage
                  src={user.image}
                  alt={userDisplayLabel || "User"}
                />
              ) : null}
              <AvatarFallback>{userInitials || "U"}</AvatarFallback>
            </Avatar>
          ) : null}
        </button>
      </div>
      <SidebarRail />
      <AccountSettingsModal
        open={accountOpen && Boolean(user)}
        onClose={() => setAccountOpen(false)}
      />
    </Sidebar>
  );
}

AppSidebar.displayName = "AppSidebar";

export default React.memo(AppSidebar);

function ChatList({
  chats,
  activePath,
  onDelete,
  deletingId,
  onHoverChat,
}: {
  chats: ChatListItem[];
  activePath?: string | null;
  onDelete: (chatId: string) => void | Promise<void>;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only virtualize when we have many chats (>30)
  const shouldVirtualize = chats.length > 30;

  const virtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // Estimated height for each chat item
    overscan: 10, // Render 10 extra items above and below viewport
    enabled: shouldVirtualize,
  });

  if (chats.length === 0)
    return <p className="px-2 text-xs text-muted-foreground">No chats</p>;

  if (!shouldVirtualize) {
    // Non-virtualized list for few chats
    return (
      <ul className="px-1 space-y-1" data-ph-no-capture>
        {chats.map((c) => (
          <ChatListItem
            key={c.id}
            chat={c}
            activePath={activePath}
            onDelete={onDelete}
            deletingId={deletingId}
            onHoverChat={onHoverChat}
          />
        ))}
      </ul>
    );
  }

  // Virtualized list for many chats
  return (
    <div
      ref={parentRef}
      className="px-1 overflow-auto"
      style={{ maxHeight: "calc(100vh - 280px)" }}
      data-ph-no-capture
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chat = chats[virtualItem.index];
          if (!chat) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-1"
            >
              <ChatListItem
                chat={chat}
                activePath={activePath}
                onDelete={onDelete}
                deletingId={deletingId}
                onHoverChat={onHoverChat}
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
}: {
  chat: ChatListItem;
  activePath?: string | null;
  onDelete: (chatId: string) => void | Promise<void>;
  deletingId: string | null;
  onHoverChat?: (chatId: string) => void;
}) {
  const hrefPath = `/dashboard/chat/${chat.id}`;
  const isActive = activePath === hrefPath;

  return (
    <div className="group relative">
      <Link
        href={`/dashboard/chat/${chat.id}`}
        prefetch
        className={cn(
          "block truncate rounded-md px-3 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
        onMouseEnter={() => onHoverChat?.(chat.id)}
        onFocus={() => onHoverChat?.(chat.id)}
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
          "absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-destructive",
          "transition-all duration-150 group-hover:opacity-100 group-hover:border-destructive/60",
          "bg-destructive/10 hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
          "hover:text-destructive-foreground focus-visible:text-destructive-foreground",
          "disabled:cursor-progress disabled:bg-muted disabled:text-muted-foreground",
          deletingId === chat.id ? "opacity-100" : "opacity-0",
        )}
        aria-label="Delete chat"
        disabled={deletingId === chat.id}
      >
        {deletingId === chat.id ? (
          <span className="animate-pulse text-base">…</span>
        ) : (
          <X className="size-4" />
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
