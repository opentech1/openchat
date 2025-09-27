"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Sparkles, Keyboard, MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useSyncedChatList, type ChatListItem } from "@/components/chat-list-helpers";
import { client } from "@/utils/orpc";
import { toast } from "sonner";
import { FOCUS_COMPOSER_EVENT } from "@/lib/events";

export function CommandMenu({ currentUserId, initialChats }: { currentUserId: string; initialChats: ChatListItem[] }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const { theme, setTheme } = useTheme();
	const { chats } = useSyncedChatList({ currentUserId, initialChats });

	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((prev) => !prev);
			}
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
				// handled by sidebar already, but keep the dialog closed when toggling collapse
				setOpen(false);
			}
		};
		window.addEventListener("keydown", down);
		return () => window.removeEventListener("keydown", down);
	}, []);

	const toggleTheme = useCallback(() => {
		if (theme === "dark") {
			setTheme("light");
		} else if (theme === "light") {
			setTheme("dark");
		} else {
			setTheme("light");
		}
		toast.success("Theme updated");
	}, [setTheme, theme]);

	const handleCreateChat = useCallback(async () => {
		setOpen(false);
		try {
			const { id } = await client.chats.create({ title: "New Chat" });
			toast.success("New chat created");
			router.push(`/dashboard/chat/${id}`);
		} catch (error) {
			console.error("command:create", error);
			toast.error("Couldn't create chat. Try again.");
		}
	}, [router]);

	const visibleChats = useMemo(() => chats.slice(0, 30), [chats]);

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput placeholder="Search chats or run a command" />
			<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Actions">
						<CommandItem
							value="new-chat"
							onSelect={() => {
								void handleCreateChat();
							}}
						>
							<Plus className="mr-2 size-4" />
							New chat
							<CommandShortcut>⌘N</CommandShortcut>
						</CommandItem>
						<CommandItem
							value="focus-composer"
							onSelect={() => {
								setOpen(false);
								window.dispatchEvent(new CustomEvent(FOCUS_COMPOSER_EVENT));
							}}
						>
							<Keyboard className="mr-2 size-4" />
							Focus composer
							<CommandShortcut>⌘L</CommandShortcut>
						</CommandItem>
						<CommandItem
							value="open-settings"
							onSelect={() => {
								setOpen(false);
								router.push("/dashboard/settings");
							}}
						>
							<Sparkles className="mr-2 size-4" />
							Workspace settings
							<CommandShortcut>⌘,</CommandShortcut>
						</CommandItem>
						<CommandItem
							value="toggle-theme"
							onSelect={() => {
								setOpen(false);
								toggleTheme();
							}}
						>
							{theme === "dark" ? <Sun className="mr-2 size-4" /> : <MoonStar className="mr-2 size-4" />}
							Toggle theme
							<CommandShortcut>⌘T</CommandShortcut>
						</CommandItem>
					</CommandGroup>
					{visibleChats.length > 0 ? (
						<>
							<CommandSeparator />
							<CommandGroup heading="Chats">
								{visibleChats.map((chat) => (
									<CommandItem
										key={chat.id}
										value={`chat-${chat.id}`}
										onSelect={() => {
											setOpen(false);
											router.push(`/dashboard/chat/${chat.id}`);
										}}
									>
										<MessageSquare className="mr-2 size-4" />
										{chat.title?.trim() ? chat.title : "Untitled"}
									</CommandItem>
								))}
							</CommandGroup>
						</>
					) : null}
			</CommandList>
		</CommandDialog>
	);
}
