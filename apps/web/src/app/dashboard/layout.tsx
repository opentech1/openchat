import type { ReactNode } from "react";
import { getUserId } from "@/lib/auth-server";
import AppSidebar from "@/components/app-sidebar-wrapper";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Settings } from "lucide-react";
import { serverClient } from "@/utils/orpc-server";
import Script from "next/script";
import DashboardAccessFallback from "@/components/dashboard-access-fallback";
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const userId = await getUserId();
	if (!userId) {
		return (
			<DashboardAccessFallback description="We need a signed-in session to load your workspace tabs." />
		);
	}

	const chats = await serverClient.chats.list().catch(() => []);
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
