"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/app-sidebar";
import MobileDashboardNav from "@/components/mobile-dashboard-nav";
import { DashboardControls } from "@/components/dashboard-controls";
import { HelpButton } from "@/components/help-button";
import { ChatExportButton } from "@/components/chat-export-button";

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
  const pathname = usePathname();
  // HYDRATION FIX: Track mount state to ensure consistent server/client render
  // AppSidebar uses hooks that access localStorage and Convex real-time data
  // which causes hydration mismatches. Only render after client mount.
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check if we're on a chat page and extract chatId
  const chatPageMatch = pathname?.match(/^\/dashboard\/chat\/([^/]+)$/);
  const chatId = chatPageMatch?.[1];
  const isOnChatPage = Boolean(chatId);

  // HYDRATION FIX: suppressHydrationWarning on root container because browser extensions
  // (like screen capture tools) can inject elements that cause hydration mismatches.
  // This is safe because the layout structure is static and doesn't depend on client state.
  return (
    <div className="relative flex h-svh overflow-hidden" suppressHydrationWarning>
      {/* Skip link - only render after mount to prevent hydration mismatch */}
      {isMounted && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
      )}
      {/* HYDRATION FIX: Render sidebar only after mount because AppSidebar uses:
          1. useChatReadStatus - accesses localStorage
          2. useChatList - Convex real-time subscription
          3. useTheme - next-themes which has SSR issues
          These cause server/client mismatch. Deferring render to client prevents #418 errors. */}
      <div className="hidden md:block" suppressHydrationWarning>
        <div className="fixed inset-y-0 left-0">
          {isMounted ? (
            <AppSidebar initialChats={chats} />
          ) : (
            // Placeholder to prevent layout shift - matches sidebar width
            <div className="w-[var(--sb-width)] h-full bg-sidebar" />
          )}
        </div>
      </div>
      <main
        id="main-content"
        className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden md:ml-[var(--sb-width)] transition-[margin] duration-200 ease-in-out w-full focus:outline-none focus-visible:outline-none"
        tabIndex={-1}
        suppressHydrationWarning
      >
        <DashboardControls />
        {/* Mobile navigation button - only show after mount to prevent hydration mismatch */}
        {isMounted && (
          <div className="pointer-events-auto absolute right-3 top-3 z-20 flex items-center gap-1 md:hidden">
            {isOnChatPage && chatId && (
              <div className="rounded-lg border border-border/40 bg-background/80 backdrop-blur-sm shadow-sm">
                <ChatExportButton chatId={chatId} />
              </div>
            )}
            <div className="rounded-lg border border-border/40 bg-background/80 backdrop-blur-sm shadow-sm">
              <MobileDashboardNav initialChats={chats} />
            </div>
          </div>
        )}
        <div className="flex h-full w-full flex-1 flex-col overflow-x-hidden min-h-0">
          {children}
        </div>
        <HelpButton />
      </main>
    </div>
  );
}
