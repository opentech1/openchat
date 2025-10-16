import type { ReactNode } from "react";
import { getUserContext } from "@/lib/auth-server";
import AppSidebar from "@/components/app-sidebar-wrapper";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Settings } from "lucide-react";
import { serverClient } from "@/utils/orpc-server";
import Script from "next/script";
import type { ChatSummary } from "@/types/server-router";
export const dynamic = "force-dynamic";

const charMap = {
    '<': '\\u003C',
    '>': '\\u003E',
    '/': '\\u002F',
    '\\': '\\\\',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\0': '\\0',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029'
};

function escapeUnsafeChars(str: string): string {
    return str.replace(/[<>\b\f\n\r\t\0\u2028\u2029/\\]/g, x => charMap[x] || x);
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const { userId } = await getUserContext();

	const rawChats: ChatSummary[] = await serverClient.chats.list().catch(() => [] as ChatSummary[]);
	const chats = rawChats.map((chat: ChatSummary) => ({
		id: chat.id,
		title: chat.title,
		updatedAt: chat.updatedAt ?? undefined,
		lastMessageAt: chat.lastMessageAt ?? null,
	}));

	return (
		<div className="relative flex h-svh overflow-hidden">
			<div className="hidden md:block">
				<div className="fixed inset-y-0 left-0">
					<AppSidebar initialChats={chats} currentUserId={userId} />
				</div>
			</div>
			<main className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full">
		<Script id="oc-user-bootstrap" strategy="afterInteractive">
			{`(() => { const u = ${escapeUnsafeChars(JSON.stringify(userId))}; window.__DEV_USER_ID__ = u; window.__OC_GUEST_ID__ = u; })();`}
		</Script>
				<div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-1 rounded-xl border bg-card/80 px-2 py-1.5 shadow-md backdrop-blur">
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
