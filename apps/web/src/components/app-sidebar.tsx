"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { X } from "lucide-react";
import { useWorkspaceChats, type WorkspaceChatRow } from "@/lib/electric/workspace-db";
import { usePathname, useRouter } from "next/navigation";
import { client } from "@/utils/orpc";
import { connect, subscribe, type Envelope } from "@/lib/sync";

export type ChatListItem = {
	id: string;
	title: string | null;
	updatedAt?: string | Date;
	lastMessageAt?: string | Date | null;
};

export type AppSidebarProps = { initialChats?: ChatListItem[]; currentUserId: string } & ComponentProps<typeof Sidebar>;

function normalizeChat(chat: ChatListItem): ChatListItem {
	return {
		...chat,
		updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : undefined,
		lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null,
	};
}

function dateToIso(value: string | Date | null | undefined) {
	if (!value) return undefined;
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString();
}

function dedupeChats(list: ChatListItem[]) {
	const map = new Map<string, ChatListItem>();
	for (const chat of list) {
		map.set(chat.id, chat);
	}
	return sortChats(Array.from(map.values()));
}

function mapLiveChat(row: WorkspaceChatRow): ChatListItem {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
  };
}

export default function AppSidebar({ initialChats = [], currentUserId, ...sidebarProps }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [optimisticChats, setOptimisticChats] = useState<ChatListItem[]>([]);
  const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

  useEffect(() => {
    if (!devBypassEnabled) return;
    if (typeof window === "undefined") return;
    if (!currentUserId) return;
    (window as any).__DEV_USER_ID__ = currentUserId;
  }, [currentUserId, devBypassEnabled]);

  const normalizedInitial = useMemo(() => initialChats.map(normalizeChat), [initialChats]);
  const [fallbackChats, setFallbackChats] = useState<ChatListItem[]>(normalizedInitial);
  useEffect(() => {
    setFallbackChats(dedupeChats(normalizedInitial));
  }, [normalizedInitial]);
	const serializedFallback = useMemo<WorkspaceChatRow[]>(
		() =>
			normalizedInitial.map((chat) => ({
				id: chat.id,
				title: chat.title,
				user_id: currentUserId,
				updated_at: dateToIso(chat.updatedAt) ?? null,
				last_message_at: dateToIso(chat.lastMessageAt) ?? null,
			})),
		[normalizedInitial, currentUserId],
	);

  const chatQuery = useWorkspaceChats(currentUserId, serializedFallback);
  const electricChats = useMemo(() => {
    if (!currentUserId) return null;
    if (!chatQuery.enabled) return null;
    const rows = chatQuery.data?.map(mapLiveChat);
    if (!rows) return null;
    return sortChats(rows);
  }, [chatQuery.data, chatQuery.enabled, currentUserId]);

  useEffect(() => {
    if (electricChats) setFallbackChats(dedupeChats(electricChats));
  }, [electricChats]);

  const baseChats = fallbackChats;
  const isLoading = chatQuery.enabled && !chatQuery.isReady && fallbackChats.length === 0;

  const chats = useMemo(() => {
    if (optimisticChats.length === 0) return baseChats;
    const baseIds = new Set(baseChats.map((chat) => chat.id));
    const supplemental = optimisticChats.filter((chat) => !baseIds.has(chat.id));
    return sortChats(baseChats.concat(supplemental));
  }, [baseChats, optimisticChats]);

  const handleCreateChat = useCallback(async () => {
    if (!currentUserId || isCreating) {
      if (!currentUserId) router.push("/auth/sign-in");
      return;
    }
    setIsCreating(true);
    try {
      const now = new Date();
      const { id } = await client.chats.create({ title: "New Chat" });
      const optimisticChat: ChatListItem = { id, title: "New Chat", updatedAt: now, lastMessageAt: now };
      setOptimisticChats((prev) => sortChats(prev.concat([optimisticChat])));
      setFallbackChats((prev) => dedupeChats(prev.concat([optimisticChat])));
      router.push(`/dashboard/chat/${id}`);
    } catch (error) {
      console.error("Failed to create chat", error);
    } finally {
      setIsCreating(false);
    }
  }, [currentUserId, isCreating, router]);

  const handleDelete = useCallback(
    async (chatId: string) => {
      if (!currentUserId || !chatId) {
        if (!currentUserId) router.push("/auth/sign-in");
        return;
      }
      setDeletingChatId(chatId);

      let removedFromFallback: ChatListItem | undefined;
      let removedFromOptimistic: ChatListItem | undefined;

      setFallbackChats((prev) => {
        const next: ChatListItem[] = [];
        for (const chat of prev) {
          if (chat.id === chatId && !removedFromFallback) {
            removedFromFallback = chat;
            continue;
          }
          next.push(chat);
        }
        return next;
      });

      setOptimisticChats((prev) => {
        const next: ChatListItem[] = [];
        for (const chat of prev) {
          if (chat.id === chatId && !removedFromOptimistic) {
            removedFromOptimistic = chat;
            continue;
          }
          next.push(chat);
        }
        return next;
      });

      try {
        await client.chats.delete({ chatId });
        if (pathname?.startsWith(`/dashboard/chat/${chatId}`)) router.replace("/dashboard");
      } catch (error) {
        console.error("Failed to delete chat", error);
        if (removedFromFallback) {
          const restore = removedFromFallback;
          setFallbackChats((prev) => {
            if (prev.some((chat) => chat.id === restore.id)) return prev;
            return dedupeChats(prev.concat([restore]));
          });
        }
        if (removedFromOptimistic) {
          const restore = removedFromOptimistic;
          setOptimisticChats((prev) => {
            if (prev.some((chat) => chat.id === restore.id)) return prev;
            return sortChats(prev.concat([restore]));
          });
        }
      } finally {
        setDeletingChatId((current) => (current === chatId ? null : current));
      }
    },
    [currentUserId, pathname, router],
  );

  useEffect(() => {
    if (!currentUserId) return;
    void connect();
    const topic = `chats:index:${currentUserId}`;
    const handler = (evt: Envelope) => {
      if (evt.type === "chats.index.add") {
        const d = evt.data as { chatId: string; title?: string; updatedAt?: string | Date; lastMessageAt?: string | Date };
        setFallbackChats((prev) => {
          if (prev.some((chat) => chat.id === d.chatId)) return prev;
          const next = prev.concat([
            {
              id: d.chatId,
              title: d.title ?? "New Chat",
              updatedAt: d.updatedAt ? new Date(d.updatedAt) : undefined,
              lastMessageAt: d.lastMessageAt ? new Date(d.lastMessageAt) : null,
            },
          ]);
          return dedupeChats(next);
        });
      } else if (evt.type === "chats.index.update") {
        const d = evt.data as { chatId: string; title?: string | null; updatedAt?: string | Date | null; lastMessageAt?: string | Date | null };
        setFallbackChats((prev) => {
          const next = prev.map((chat) =>
            chat.id === d.chatId
              ? {
                  ...chat,
                  title: d.title ?? chat.title,
                  updatedAt: d.updatedAt != null ? new Date(d.updatedAt) : chat.updatedAt,
                  lastMessageAt: d.lastMessageAt != null ? new Date(d.lastMessageAt) : chat.lastMessageAt,
                }
              : chat,
          );
          return dedupeChats(next);
        });
      } else if (evt.type === "chats.index.remove") {
        const d = evt.data as { chatId: string };
        setFallbackChats((prev) => prev.filter((chat) => chat.id !== d.chatId));
      }
    };
    const unsubscribe = subscribe(topic, handler);
    return () => {
      unsubscribe();
    };
	}, [currentUserId]);

  return (
    <Sidebar defaultCollapsed {...sidebarProps}>
      <SidebarHeader className="px-2 py-3">
        <div className="flex items-center justify-center">
          <Link
            href="/dashboard"
            className={cn("select-none text-lg font-semibold tracking-tight md:text-xl leading-none")}
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
            disabled={!currentUserId || isCreating}
          >
            {isCreating ? "Creating…" : "New Chat"}
          </Button>
        </SidebarGroup>
      <SidebarGroup>
        <div className="flex items-center justify-between px-2 py-1.5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chats</h3>
        </div>
          <ChatList
            chats={chats}
            isLoading={isLoading}
            activePath={pathname}
            onDelete={handleDelete}
            deletingId={deletingChatId}
          />
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2">
        <div className="flex items-center justify-between rounded-md px-2 py-1.5">
          <span className="text-xs text-muted-foreground">Account</span>
          {process.env.NODE_ENV === "test" ? null : <UserButton afterSignOutUrl="/" userProfileMode="modal" />}
        </div>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}

function ChatList({
  chats,
  isLoading,
  activePath,
  onDelete,
  deletingId,
}: {
  chats: ChatListItem[];
  isLoading?: boolean;
  activePath?: string | null;
  onDelete: (chatId: string) => void | Promise<void>;
  deletingId: string | null;
}) {
  if (isLoading && chats.length === 0) {
    return <p className="px-2 text-xs text-muted-foreground">Syncing chats…</p>;
  }
  if (chats.length === 0) return <p className="px-2 text-xs text-muted-foreground">No chats</p>;
  return (
    <ul className="px-1 space-y-1">
      {chats.map((c) => {
        const href = `/dashboard/chat/${c.id}`;
        const isActive = activePath === href;
        return (
          <li key={c.id} className="group relative">
            <Link
              href={href}
              className={cn(
                "block truncate rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {c.title || "Untitled"}
            </Link>
					<button
						type="button"
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							void onDelete(c.id);
						}}
						className={cn(
							"absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-destructive",
							"transition-all duration-150 group-hover:opacity-100 group-hover:border-destructive/60",
							"bg-destructive/10 hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
							"hover:text-destructive-foreground focus-visible:text-destructive-foreground",
							"disabled:cursor-progress disabled:bg-muted disabled:text-muted-foreground",
							deletingId === c.id ? "opacity-100" : "opacity-0",
						)}
						aria-label="Delete chat"
						disabled={deletingId === c.id}
					>
						{deletingId === c.id ? (
							<span className="animate-pulse text-base">…</span>
						) : (
							<X className="h-4 w-4" />
						)}
					</button>
          </li>
        );
      })}
    </ul>
  );
}

function sortChats(list: ChatListItem[]) {
  const copy = list.slice();
  copy.sort((a, b) => {
    const aLast = (a.lastMessageAt ? new Date(a.lastMessageAt) : a.updatedAt ? new Date(a.updatedAt) : new Date(0)).getTime();
    const bLast = (b.lastMessageAt ? new Date(b.lastMessageAt) : b.updatedAt ? new Date(b.updatedAt) : new Date(0)).getTime();
    if (bLast !== aLast) return bLast - aLast;
    const aUp = (a.updatedAt ? new Date(a.updatedAt) : new Date(0)).getTime();
    const bUp = (b.updatedAt ? new Date(b.updatedAt) : new Date(0)).getTime();
    return bUp - aUp;
  });
  return copy;
}
