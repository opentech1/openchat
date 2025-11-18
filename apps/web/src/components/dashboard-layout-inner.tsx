"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Settings } from "@/lib/icons";
import AppSidebar from "@/components/app-sidebar";
import MobileDashboardNav from "@/components/mobile-dashboard-nav";
import ThemeToggle from "@/components/theme-toggle";
import { spacing, opacity, iconSize } from "@/styles/design-tokens";
import { DashboardControls } from "@/components/dashboard-controls";
import { HelpButton } from "@/components/help-button";

type DashboardLayoutClientProps = {
  children: ReactNode;
  chats: Array<{
    id: string;
    title: string;
    updatedAt: string;
    lastMessageAt: string | null;
  }>;
};

export default function DashboardLayoutClient({
  children,
  chats,
}: DashboardLayoutClientProps) {
  return (
    <div className="relative flex h-svh overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="hidden md:block">
        <div className="fixed inset-y-0 left-0">
          <AppSidebar initialChats={chats} />
        </div>
      </div>
      <main
        id="main-content"
        className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full focus:outline-none focus-visible:outline-none"
        tabIndex={-1}
      >
        <DashboardControls />
        <div
          className={`pointer-events-auto absolute right-4 top-4 z-20 flex items-center rounded-xl border bg-card/${opacity.subtle} px-3 py-1.5 shadow-md backdrop-blur ${spacing.gap.sm}`}
        >
          <MobileDashboardNav initialChats={chats} />
          <Link
            href="/dashboard/settings"
            className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
            aria-label="Settings"
          >
            <Settings className={iconSize.sm} />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex h-full w-full flex-1 flex-col overflow-x-hidden min-h-0">
          {children}
        </div>
        <HelpButton />
      </main>
    </div>
  );
}
