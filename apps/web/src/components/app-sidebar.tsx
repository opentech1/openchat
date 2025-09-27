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
import { X, Pencil, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { client } from "@/utils/orpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/date";
import {
	ChatListItem,
	dedupeChats,
	sortChats,
	useSyncedChatList,
} from "@/components/chat-list-helpers";

export type AppSidebarProps = {
	initialChats?: ChatListItem[];
	currentUserId: string;
	showRail?: boolean;
} & ComponentProps<typeof Sidebar>;

export default function AppSidebar({ initialChats = [], currentUserId, showRail = true, ...sidebarProps }: AppSidebarProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
	const [renameDraft, setRenameDraft] = useState("");
	const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

	const { chats, isLoading, setFallbackChats, setOptimisticChats } = useSyncedChatList({ currentUserId, initialChats });

	useEffect(() => {
		if (!devBypassEnabled) return;
		if (typeof window === "undefined") return;
		if (!currentUserId) return;
		(window as any).__DEV_USER_ID__ = currentUserId;
	}, [currentUserId, devBypassEnabled]);

	const filteredChats = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return chats;
		return chats.filter((chat) => (chat.title ?? "Untitled").toLowerCase().includes(term));
	}, [chats, searchTerm]);

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
			toast.success("New chat created");
			router.push(`/dashboard/chat/${id}`);
		} catch (error) {
			console.error("Failed to create chat", error);
			toast.error("Couldn't create chat. Try again.");
		} finally {
			setIsCreating(false);
		}
	}, [currentUserId, isCreating, router, setFallbackChats, setOptimisticChats]);

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
				toast.success("Chat deleted");
			} catch (error) {
				console.error("Failed to delete chat", error);
				toast.error("Couldn't delete chat. Restored previous state.");
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
		[currentUserId, pathname, router, setFallbackChats, setOptimisticChats],
	);

	const handleRename = useCallback(
		async (chatId: string, nextTitle: string) => {
			const trimmed = nextTitle.trim();
			if (!trimmed) {
				toast.error("Title can't be empty.");
				return false;
			}
			const prior = chats.find((chat) => chat.id === chatId);
			if (!prior) return false;
			setFallbackChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: trimmed } : chat)));
			setOptimisticChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: trimmed } : chat)));
			try {
				await client.chats.rename({ chatId, title: trimmed });
				toast.success("Chat renamed");
				return true;
			} catch (error) {
				console.error("Failed to rename chat", error);
				toast.error("Couldn't rename chat. Restored previous name.");
				setFallbackChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: prior.title } : chat)));
				setOptimisticChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: prior.title } : chat)));
				return false;
			}
		},
		[chats, setFallbackChats, setOptimisticChats],
	);

	return (
		<Sidebar defaultCollapsed {...sidebarProps}>
			<SidebarHeader className="px-3 py-4">
				<div className="flex items-center justify-between gap-2">
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
					<div className="space-y-2 px-2">
						<div className="flex items-center justify-between">
							<h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chats</h3>
							<span className="text-xs text-muted-foreground/70">{chats.length}</span>
						</div>
						<div className="relative">
							<Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2" />
							<Input
								type="search"
								value={searchTerm}
								onChange={(event) => setSearchTerm(event.target.value)}
								placeholder="Search chats"
								className="pl-8 text-sm"
							/>
						</div>
					</div>
					<ChatList
						chats={filteredChats}
						allChats={chats}
						isLoading={isLoading}
						activePath={pathname}
						onDelete={handleDelete}
						deletingId={deletingChatId}
						onRename={async (chatId, title) => {
							const ok = await handleRename(chatId, title);
							if (ok) {
								setRenamingChatId(null);
								setRenameDraft("");
							}
						}}
						renamingChatId={renamingChatId}
						renameDraft={renameDraft}
						onRenameDraftChange={setRenameDraft}
						onStartRename={(chat) => {
							setRenamingChatId(chat.id);
							setRenameDraft(chat.title ?? "");
						}}
						onCancelRename={() => {
							setRenamingChatId(null);
							setRenameDraft("");
						}}
					/>
				</SidebarGroup>
			</SidebarContent>
			<div className="mt-auto w-full px-2 pb-3 pt-2">
				<div className="flex items-center justify-between rounded-md px-2 py-1.5">
					<span className="text-xs text-muted-foreground">Account</span>
					{process.env.NODE_ENV === "test" ? null : <UserButton afterSignOutUrl="/" userProfileMode="modal" />}
				</div>
			</div>
			{showRail ? <SidebarRail /> : null}
		</Sidebar>
	);
}

function ChatList({
	chats,
	allChats,
	isLoading,
	activePath,
	onDelete,
	deletingId,
	onRename,
	renamingChatId,
	renameDraft,
	onRenameDraftChange,
	onStartRename,
	onCancelRename,
}: {
	chats: ChatListItem[];
	allChats: ChatListItem[];
	isLoading?: boolean;
	activePath?: string | null;
	onDelete: (chatId: string) => void | Promise<void>;
	deletingId: string | null;
	onRename: (chatId: string, title: string) => Promise<boolean>;
	renamingChatId: string | null;
	renameDraft: string;
	onRenameDraftChange: (value: string) => void;
	onStartRename: (chat: ChatListItem) => void;
	onCancelRename: () => void;
}) {
	if (isLoading && allChats.length === 0) {
		return <p className="px-2 text-xs text-muted-foreground">Syncing chats…</p>;
	}
	if (chats.length === 0) {
		const hasAny = allChats.length > 0;
		return (
			<p className="px-2 text-xs text-muted-foreground">
				{hasAny ? "No chats match your search." : "No chats yet"}
			</p>
		);
	}
	return (
		<TooltipProvider delayDuration={150}>
			<ul className="space-y-1 px-1">
				{chats.map((chat) => {
					const hrefPath = `/dashboard/chat/${chat.id}`;
					const href = { pathname: "/dashboard/chat/[id]", params: { id: chat.id } } as const;
					const isActive = activePath === hrefPath;
					const isRenaming = renamingChatId === chat.id;
					const lastActivityLabel = formatRelativeTime(chat.lastMessageAt ?? chat.updatedAt ?? null);
					return (
						<li key={chat.id} className="group relative rounded-lg">
							{isRenaming ? (
								<form
									className="bg-muted/40 border-border flex flex-col gap-2 rounded-lg border px-3 py-2"
									onSubmit={async (event) => {
										event.preventDefault();
										const ok = await onRename(chat.id, renameDraft);
										if (ok) onCancelRename();
									}}
								>
									<Input
										autoFocus
										data-testid="rename-chat-input"
										value={renameDraft}
										onChange={(event) => onRenameDraftChange(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Escape") {
												event.preventDefault();
												onCancelRename();
											}
										}}
										placeholder="Rename chat"
										className="h-9"
									/>
									<div className="flex justify-end gap-2">
										<Button type="button" variant="ghost" size="sm" onClick={onCancelRename}>
											Cancel
										</Button>
										<Button type="submit" size="sm" disabled={!renameDraft.trim()}>
											Save
										</Button>
									</div>
								</form>
							) : (
								<>
									<Link
										href={href}
										prefetch
										className={cn(
											"border-border/60 relative block rounded-lg border px-3 py-2 text-left transition-colors",
											isActive
												? "border-primary bg-primary/10 text-primary"
												: "hover:border-border/80 hover:bg-accent hover:text-accent-foreground",
										)}
										aria-current={isActive ? "page" : undefined}
									>
										<div className="flex flex-col gap-1">
											<span className="truncate text-sm font-medium">
												{chat.title?.trim() ? chat.title : "Untitled"}
											</span>
											<span className="text-xs text-muted-foreground">
												{lastActivityLabel ? `Last updated ${lastActivityLabel}` : "No activity yet"}
											</span>
										</div>
									</Link>
									<div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													type="button"
													onClick={(event) => {
														event.preventDefault();
														event.stopPropagation();
														onStartRename(chat);
													}}
													className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md border border-transparent bg-background/80 text-muted-foreground shadow-sm transition-colors hover:border-border/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													aria-label="Rename chat"
												>
													<Pencil className="size-4" />
												</button>
											</TooltipTrigger>
											<TooltipContent side="left">Rename</TooltipContent>
										</Tooltip>
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													type="button"
													onClick={(event) => {
														event.preventDefault();
														event.stopPropagation();
														void onDelete(chat.id);
													}}
													className={cn(
														"pointer-events-auto inline-flex size-8 items-center justify-center rounded-md border border-transparent bg-destructive/10 text-destructive transition-colors",
														"hover:border-destructive/50 hover:bg-destructive/20 hover:text-destructive-foreground",
														"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive",
														"disabled:cursor-progress disabled:opacity-60",
													)}
													aria-label="Delete chat"
													disabled={deletingId === chat.id}
												>
													{deletingId === chat.id ? <span className="text-xs font-medium">…</span> : <X className="size-4" />}
												</button>
											</TooltipTrigger>
											<TooltipContent side="left">Delete</TooltipContent>
										</Tooltip>
									</div>
								</>
							)}
						</li>
					);
				})}
			</ul>
		</TooltipProvider>
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
