"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ThemeToggle from "@/components/theme-toggle";
import AppSidebarWrapper from "@/components/app-sidebar-wrapper";
import type { ChatListItem } from "@/components/chat-list-helpers";

export function DashboardTopBar({ currentUserId, initialChats }: { currentUserId: string; initialChats: ChatListItem[] }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="border-border/60 bg-background/95 sticky top-0 z-30 flex items-center justify-between border-b px-3 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:hidden">
			<div className="flex items-center gap-2">
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="Toggle sidebar">
							<Menu className="size-4" />
						</Button>
					</SheetTrigger>
					<SheetContent side="left" className="w-[85vw] max-w-sm border-r p-0">
						<AppSidebarWrapper
							initialChats={initialChats}
							currentUserId={currentUserId}
							defaultCollapsed={false}
							showRail={false}
							className="h-[100vh]"
						/>
					</SheetContent>
				</Sheet>
				<Link href="/dashboard" className="text-base font-semibold tracking-tight">
					OpenChat
				</Link>
			</div>
			<div className="flex items-center gap-1">
				<Button asChild variant="ghost" size="icon" aria-label="Open settings">
					<Link href="/dashboard/settings">
						<Settings className="size-4" />
					</Link>
				</Button>
				<ThemeToggle />
			</div>
		</div>
	);
}
