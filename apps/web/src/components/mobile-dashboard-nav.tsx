"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Menu, X, Settings, MessageSquare } from "@/lib/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { captureClientEvent } from "@/lib/posthog";
import { AccountSettingsModalLazy as AccountSettingsModal } from "@/components/lazy/account-settings-modal-lazy";
import { logError } from "@/lib/logger";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { Logo } from "@/components/logo";
import ThemeToggle from "@/components/theme-toggle";
import type { ChatListItem } from "@/components/app-sidebar";
import { iconSize } from "@/styles/design-tokens";
import { invalidateChatsCache, useChatsInvalidation } from "@/lib/cache-utils";

type MobileDashboardNavProps = {
	initialChats?: ChatListItem[];
};

export default function MobileDashboardNav({ initialChats = [] }: MobileDashboardNavProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const openDrawer = useCallback(() => setIsOpen(true), []);
	const closeDrawer = useCallback(() => setIsOpen(false), []);

	// Lock body scroll when open
	useEffect(() => {
		if (!isOpen) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen]);

	// Close on escape
	useEffect(() => {
		if (!isOpen) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeDrawer();
		};
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [isOpen, closeDrawer]);

	const drawerContent = isOpen ? (
		<MobileDrawer isOpen={isOpen} onClose={closeDrawer} initialChats={initialChats} />
	) : null;

	return (
		<>
			{/* Trigger Button */}
			<button
				type="button"
				onClick={openDrawer}
				className="md:hidden inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
				aria-label="Open menu"
			>
				<Menu className={iconSize.sm} />
			</button>

			{/* Portal the drawer to document.body */}
			{mounted && drawerContent && createPortal(drawerContent, document.body)}
		</>
	);
}

function MobileDrawer({
	isOpen,
	onClose,
	initialChats,
}: {
	isOpen: boolean;
	onClose: () => void;
	initialChats: ChatListItem[];
}) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: session } = useSession();
	const user = session?.user;
	const { resolvedTheme, setTheme } = useTheme();
	const [accountOpen, setAccountOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);

	// Chat state
	const [chats, setChats] = useState<ChatListItem[]>(initialChats);
	const [isLoadingChats, setIsLoadingChats] = useState(initialChats.length === 0);
	const [hasFetched, setHasFetched] = useState(initialChats.length > 0);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Refetch chats from API
	const refetchChats = useCallback(async () => {
		if (!user?.id) return;
		try {
			const res = await fetch("/api/chats?limit=200", { credentials: "include" });
			if (res.ok) {
				const data = await res.json();
				setChats(data.chats || []);
			}
		} catch (err) {
			logError("Failed to refetch chats", err);
		}
	}, [user?.id]);

	// Listen for cache invalidation events to refetch chat list
	useChatsInvalidation(refetchChats);

	// Fetch chats if not provided
	useEffect(() => {
		if (hasFetched || !user?.id) return;

		const fetchChats = async () => {
			setIsLoadingChats(true);
			try {
				const res = await fetch("/api/chats?limit=200", { credentials: "include" });
				if (res.ok) {
					const data = await res.json();
					setChats(data.chats || []);
				}
			} catch (err) {
				logError("Failed to fetch chats", err);
			} finally {
				setIsLoadingChats(false);
				setHasFetched(true);
			}
		};
		void fetchChats();
	}, [user?.id, hasFetched]);

	// Focus trap - focus the panel when opened
	useEffect(() => {
		if (isOpen && panelRef.current) {
			panelRef.current.focus();
		}
	}, [isOpen]);

	const handleCreateChat = async () => {
		if (isCreating) return;
		setIsCreating(true);
		try {
			const res = await fetchWithCsrf("/api/chats", {
				method: "POST",
				headers: { "content-type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ title: "New Chat" }),
			});
			const data = await res.json();
			if (!res.ok || !data.chat) throw new Error(data.error || "Failed");
			setChats((prev) => [data.chat, ...prev]);
			// Notify other components (sidebar, etc.) to refresh their chat list
			invalidateChatsCache();
			captureClientEvent("chat.created", { chat_id: data.chat.id, source: "mobile" });
			onClose();
			router.push(`/chat/${data.chat.id}`);
		} catch (err) {
			logError("Create chat failed", err);
			toast.error(err instanceof Error ? err.message : "Failed to create chat");
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteChat = async (chatId: string) => {
		setDeletingChatId(chatId);
		try {
			const res = await fetchWithCsrf(`/api/chats/${chatId}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to delete");
			setChats((prev) => prev.filter((c) => c.id !== chatId));
			// Notify other components (sidebar, etc.) to refresh their chat list
			invalidateChatsCache();
		} catch (err) {
			logError("Delete chat failed", err);
			toast.error("Failed to delete chat");
		} finally {
			setDeletingChatId(null);
		}
	};

	const handleChatClick = (chatId: string) => {
		onClose();
		router.push(`/chat/${chatId}`);
	};

	const userDisplayName = user?.name || user?.email || "User";
	const userInitials = userDisplayName
		.split(" ")
		.slice(0, 2)
		.map((n) => n[0]?.toUpperCase())
		.join("");

	const isDark = mounted && resolvedTheme === "dark";

	return (
		<div className="fixed inset-0 z-[9999] md:hidden">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Drawer Panel */}
			<div
				ref={panelRef}
				tabIndex={-1}
				className="absolute top-0 right-0 bottom-0 w-[85vw] max-w-[320px] bg-background border-l border-border shadow-2xl flex flex-col outline-none"
				role="dialog"
				aria-modal="true"
				aria-label="Navigation menu"
			>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border">
					<Link href="/" onClick={onClose} className="flex items-center">
						<Logo size="default" />
					</Link>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
						aria-label="Close menu"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* New Chat Button */}
				<div className="px-4 py-3 border-b border-border">
					<Button
						onClick={() => void handleCreateChat()}
						disabled={!user || isCreating}
						className="w-full"
					>
						{isCreating ? "Creating..." : "New Chat"}
					</Button>
				</div>

				{/* Chat List */}
				<div className="flex-1 overflow-y-auto">
					<div className="px-4 py-2">
						<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Chats
						</h3>
					</div>

					{isLoadingChats ? (
						<div className="px-4 py-8 text-center">
							<p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
						</div>
					) : chats.length === 0 ? (
						<div className="px-4 py-8 text-center">
							<div className="inline-flex items-center justify-center size-12 rounded-full bg-muted mb-3">
								<MessageSquare className="size-6 text-muted-foreground" />
							</div>
							<p className="text-sm font-medium">No chats yet</p>
							<p className="text-xs text-muted-foreground mt-1">Create one to get started</p>
						</div>
					) : (
						<div className="px-2 space-y-0.5">
							{chats.map((chat) => {
								const isActive = pathname === `/chat/${chat.id}`;
								return (
									<div key={chat.id} className="group relative">
										<button
											type="button"
											onClick={() => handleChatClick(chat.id)}
											onMouseEnter={() => {
												router.prefetch(`/chat/${chat.id}`);
											}}
											className={cn(
												"w-full text-left truncate rounded-lg px-3 py-2.5 text-sm transition-colors",
												isActive
													? "bg-accent text-accent-foreground font-medium"
													: "text-foreground hover:bg-accent/50"
											)}
										>
											{chat.title || "Untitled"}
										</button>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												void handleDeleteChat(chat.id);
											}}
											disabled={deletingChatId === chat.id}
											className={cn(
												"absolute right-2 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md",
												"text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all",
												deletingChatId === chat.id
													? "opacity-100"
													: "opacity-0 group-hover:opacity-100"
											)}
											aria-label="Delete chat"
										>
											{deletingChatId === chat.id ? (
												<span className="text-xs animate-pulse">...</span>
											) : (
												<X className="size-4" />
											)}
										</button>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="mt-auto border-t border-border p-4 space-y-3">
					{/* Settings & Theme */}
					<div className="flex gap-2">
						<Link
							href="/settings"
							onClick={onClose}
							className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
						>
							<Settings className="size-4" />
							Settings
						</Link>
						<button
							type="button"
							onClick={() => setTheme(isDark ? "light" : "dark")}
							className="flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent transition-colors"
							aria-label="Toggle theme"
						>
							<ThemeToggle asIcon />
						</button>
					</div>

					{/* Account */}
					<button
						type="button"
						onClick={() => setAccountOpen(true)}
						className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-accent transition-colors"
					>
						<Avatar className="size-9">
							{user?.image && <AvatarImage src={user.image} alt={userDisplayName} />}
							<AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
								{userInitials || "U"}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{userDisplayName}</p>
							{user?.email && (
								<p className="text-xs text-muted-foreground truncate">{user.email}</p>
							)}
						</div>
					</button>
				</div>

				<AccountSettingsModal
					open={accountOpen && !!user}
					onClose={() => setAccountOpen(false)}
				/>
			</div>
		</div>
	);
}
