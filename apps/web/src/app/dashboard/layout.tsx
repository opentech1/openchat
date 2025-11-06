import type { ReactNode } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, listChats } from "@/lib/convex-server";
import AppSidebar from "@/components/app-sidebar-wrapper";
import MobileDashboardNav from "@/components/mobile-dashboard-nav";
import ThemeToggle from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const session = await getUserContext();
	const convexUserId = await ensureConvexUser({
		id: session.userId,
		email: session.email,
		name: session.name,
		image: session.image,
	});
	const { chats: rawChats } = await listChats(convexUserId);
	const chats = rawChats.map((chat) => ({
		id: chat._id,
		title: chat.title,
		updatedAt: new Date(chat.updatedAt).toISOString(),
		lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
	}));

	return (
		<div className="relative flex h-svh overflow-hidden">
			<div className="hidden md:block">
				<div className="fixed inset-y-0 left-0">
					<AppSidebar initialChats={chats} authUserId={session.userId} />
				</div>
			</div>
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full">
                <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border bg-card/80 px-2 py-1.5 shadow-md backdrop-blur">
                    <MobileDashboardNav initialChats={chats} authUserId={session.userId} />
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
