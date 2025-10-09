"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@openchat/auth/client";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWorkspaceChats, type WorkspaceChatRow } from "@/lib/electric/workspace-db";
import { client } from "@/utils/orpc";
import { connect, subscribe, type Envelope } from "@/lib/sync";
import { captureClientEvent } from "@/lib/posthog";
import { AccountSettingsModal } from "@/components/account-settings-modal";

export type ChatListItem = {
	id: string;
	title: string | null;
	updatedAt?: string | Date;
	lastMessageAt?: string | Date | null;
};

export type AppSidebarProps = { initialChats?: ChatListItem[]; currentUserId: string } & ComponentProps<typeof Sidebar>;

function toDate(value: string | Date | null | undefined) {
	if (!value) return undefined;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function pickLatestDate(a?: string | Date | null, b?: string | Date | null) {
	const aDate = toDate(a ?? undefined);
	const bDate = toDate(b ?? undefined);
	if (!aDate && !bDate) return undefined;
	if (!aDate) return bDate;
	if (!bDate) return aDate;
	return aDate.getTime() >= bDate.getTime() ? aDate : bDate;
}

function normalizeChat(chat: ChatListItem): ChatListItem {
	const updatedAt = toDate(chat.updatedAt ?? undefined);
	const lastMessageAt = toDate(chat.lastMessageAt ?? undefined) ?? null;
	return {
		...chat,
		updatedAt,
		lastMessageAt,
	};
}

function dateToIso(value: string | Date | null | undefined) {
	if (!value) return undefined;
	const date = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString();
}

function mergeChat(existing: ChatListItem | undefined, incoming: ChatListItem): ChatListItem {
	const next = normalizeChat(incoming);
	if (!existing) return next;
	const current = normalizeChat(existing);
	return {
		...current,
		...next,
		title: next.title ?? current.title ?? null,
		updatedAt: pickLatestDate(current.updatedAt, next.updatedAt),
		lastMessageAt: pickLatestDate(current.lastMessageAt, next.lastMessageAt) ?? null,
	};
}

function dedupeChats(list: ChatListItem[]) {
	const map = new Map<string, ChatListItem>();
	for (const chat of list) {
		const existing = map.get(chat.id);
		map.set(chat.id, mergeChat(existing, chat));
	}
	return sortChats(Array.from(map.values()));
}

function upsertChat(list: ChatListItem[], chat: ChatListItem) {
	return dedupeChats(list.concat([chat]));
}

function mapLiveChat(row: WorkspaceChatRow): ChatListItem {
	return normalizeChat({
		id: row.id,
		title: row.title,
		updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
		lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
	});
}

export default function AppSidebar({ initialChats = [], currentUserId, ...sidebarProps }: AppSidebarProps) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: session } = authClient.useSession();
	const [accountOpen, setAccountOpen] = useState(false);
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
	const [fallbackChats, setFallbackChats] = useState<ChatListItem[]>(() => dedupeChats(normalizedInitial));
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
		return dedupeChats(rows);
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

	useEffect(() => {
		if (baseChats.length === 0) return;
		const baseIds = new Set(baseChats.map((chat) => chat.id));
		setOptimisticChats((prev) => {
			if (prev.length === 0) return prev;
			const filtered = prev.filter((chat) => !baseIds.has(chat.id));
			return filtered.length === prev.length ? prev : filtered;
		});
	}, [baseChats]);

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
		setOptimisticChats((prev) => upsertChat(prev, optimisticChat));
		setFallbackChats((prev) => upsertChat(prev, optimisticChat));
		captureClientEvent("chat_created", { chatId: id, createdAt: now.toISOString() });
		await router.push(`/dashboard/chat/${id}`);
	} catch (error) {
		console.error("create chat", error);
	} finally {
		setIsCreating(false);
		}
	}, [currentUserId, isCreating, router]);

	const handleDelete = useCallback(
		async (chatId: string) => {
			setDeletingChatId(chatId);
			try {
				await client.chats.delete({ chatId });
				setOptimisticChats((prev) => prev.filter((chat) => chat.id !== chatId));
				setFallbackChats((prev) => prev.filter((chat) => chat.id !== chatId));
			} catch (error) {
				console.error("delete chat", error);
			} finally {
				setDeletingChatId(null);
			}
		},
		[],
	);

	useEffect(() => {
		if (!currentUserId) return undefined;
		const topic = `chats:index:${currentUserId}`;
		let active = true;
		void connect();
		const unsubscribe = subscribe(topic, (envelope: Envelope) => {
			if (!active) return;
			switch (envelope.type) {
				case "chats.index.add": {
					const payload = envelope.data as {
						chatId: string;
						title?: string | null;
						updatedAt?: number | string | Date;
						lastMessageAt?: number | string | Date | null;
				};
				const optimisticChat: ChatListItem = {
					id: payload.chatId,
					title: payload.title ?? "New Chat",
					updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : new Date(),
					lastMessageAt: payload.lastMessageAt ? new Date(payload.lastMessageAt) : null,
				};
				setOptimisticChats((prev) => upsertChat(prev, optimisticChat));
				setFallbackChats((prev) => upsertChat(prev, optimisticChat));
				break;
			}
				case "chats.index.remove": {
					const payload = envelope.data as { chatId: string };
					setOptimisticChats((prev) => prev.filter((chat) => chat.id !== payload.chatId));
					setFallbackChats((prev) => prev.filter((chat) => chat.id !== payload.chatId));
					break;
				}
			}
			});
			return () => {
				active = false;
				try {
					unsubscribe?.();
				} catch (error) {
					console.error("unsubscribe", error);
				}
			};
		}, [currentUserId]);

	const userInitials = useMemo(() => {
		const label = session?.user?.name || session?.user?.email || "";
		if (!label) return "";
		const parts = label.trim().split(/\s+/);
		return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
	}, [session?.user?.email, session?.user?.name]);

	return (
		<Sidebar defaultCollapsed {...sidebarProps}>
			<SidebarHeader className="px-2 py-3">
				<div className="flex items-center justify-center">
					<Link href="/dashboard" className={cn("select-none text-lg font-semibold tracking-tight md:text-xl leading-none")}>
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
					<ChatList chats={chats} isLoading={isLoading} activePath={pathname} onDelete={handleDelete} deletingId={deletingChatId} />
				</SidebarGroup>
			</SidebarContent>
			<div className="mt-auto w-full px-2 pb-3 pt-2">
				<button
					type="button"
					onClick={() => setAccountOpen(true)}
					className="hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition"
				>
					<span className="text-xs text-muted-foreground">Account</span>
					{session?.user ? (
						<Avatar className="size-8">
							{session.user.image ? (
								<AvatarImage src={session.user.image} alt={session.user.name ?? session.user.email ?? "User"} />
							) : null}
							<AvatarFallback>{userInitials || "U"}</AvatarFallback>
						</Avatar>
					) : (
						<Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
							<Link href="/auth/sign-in">Sign in</Link>
						</Button>
					)}
				</button>
			</div>
			<SidebarRail />
			<AccountSettingsModal open={accountOpen && Boolean(session?.user)} onClose={() => setAccountOpen(false)} />
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
		<ul className="px-1 space-y-1" data-ph-no-capture>
			{chats.map((c) => {
				const hrefPath = `/dashboard/chat/${c.id}`;
				const href = { pathname: "/dashboard/chat/[id]" as const, query: { id: c.id } };
				const isActive = activePath === hrefPath;
				return (
					<li key={c.id} className="group relative">
						<Link
							href={href}
							prefetch
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
							{deletingId === c.id ? <span className="animate-pulse text-base">…</span> : <X className="h-4 w-4" />}
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
