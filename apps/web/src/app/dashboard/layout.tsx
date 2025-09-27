import type { ReactNode } from "react";
import { getUserId } from "@/lib/auth-server";
import AppSidebar from "@/components/app-sidebar-wrapper";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Settings } from "lucide-react";
import { serverClient } from "@/utils/orpc-server";
import Script from "next/script";
import DashboardAccessFallback from "@/components/dashboard-access-fallback";
import type { ChatSummary } from "@/types/server-router";
import { DashboardTopBar } from "@/components/dashboard-top-bar";
import { CommandMenu } from "@/components/command-menu";
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const userId = await getUserId();
	if (!userId) {
		return (
			<DashboardAccessFallback description="We need a signed-in session to load your workspace tabs." />
		);
	}

	const rawChats: ChatSummary[] = await serverClient.chats.list().catch(() => [] as ChatSummary[]);
	const chats = rawChats.map((chat: ChatSummary) => ({
		id: chat.id,
		title: chat.title,
		updatedAt: chat.updatedAt ?? undefined,
		lastMessageAt: chat.lastMessageAt ?? null,
	}));
	const devBypassEnabled = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "0";

	return (
		<div className="relative flex h-svh overflow-hidden">
			<div className="hidden md:block">
				<div className="fixed inset-y-0 left-0">
					<AppSidebar initialChats={chats} currentUserId={userId} />
				</div>
			</div>
			<main className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full">
				{devBypassEnabled ? (
					<Script id="oc-dev-user" strategy="afterInteractive">
						{`window.__DEV_USER_ID__ = ${JSON.stringify(userId)};`}
					</Script>
				) : null}
				<CommandMenu currentUserId={userId} initialChats={chats} />
				<DashboardTopBar currentUserId={userId} initialChats={chats} />
				<div className="pointer-events-auto absolute right-4 top-4 z-20 hidden items-center gap-1 rounded-xl border bg-card/80 px-2 py-1.5 shadow-md backdrop-blur md:flex">
					<Link
						href="/dashboard/settings"
						className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
						aria-label="Settings"
					>
						<Settings className="size-4" />
					</Link>
					<ThemeToggle />
				</div>
				<div className="flex h-full w-full flex-1 flex-col overflow-hidden min-h-0">
					{children}
				</div>
			</main>
		</div>
	);
}
