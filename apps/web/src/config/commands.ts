import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export type CommandGroup = {
	label: string;
	items: Array<{
		id: string;
		title: string;
		subtitle?: string;
		href?: Route;
		action?: () => void;
		icon?: LucideIcon;
		shortcut?: string;
		keywords?: string[];
	}>;
};

export const commands: CommandGroup[] = [
	{
		label: "Chat",
		items: [
			{
				id: "chat-new",
				title: "New Chat",
				subtitle: "Start a new conversation",
				keywords: ["create", "conversation", "thread"],
				shortcut: "⌘N",
			},
		],
	},
	{
		label: "Navigation",
		items: [
			{
				id: "nav-home",
				title: "Home",
				subtitle: "Go to the homepage",
				href: "/",
				keywords: ["start", "root", "index"],
			},
		],
	},
	{
		label: "Theme",
		items: [
			{ id: "theme-light", title: "Light", subtitle: "Switch to light theme" },
			{ id: "theme-dark", title: "Dark", subtitle: "Switch to dark theme" },
			{ id: "theme-system", title: "System", subtitle: "Follow system theme" },
		],
	},
	{
		label: "Settings",
		items: [
			{ id: "settings-profile", title: "Profile", shortcut: "⌘P" },
			{ id: "settings-billing", title: "Billing", shortcut: "⌘B" },
			{ id: "settings-preferences", title: "Settings", shortcut: "⌘S" },
		],
	},
];
