import * as React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import AppSidebarWrapper from "@web/components/app-sidebar-wrapper";
import ThemeToggle from "@web/components/theme-toggle";
import { Settings } from "lucide-react";
import ChatPreview from "@web/components/chat-preview";
import { client } from "@start/utils/orpc";

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (!data?.user?.id) throw redirect({ to: "/auth/sign-in" });
    // prefetch chat list
    const chats = await client.chats.list().catch(() => [] as any[]);
    return { userId: data.user.id as string, chats };
  },
  component: Dashboard,
});

function Dashboard() {
  const { userId, chats } = Route.useLoaderData() as { userId: string; chats: Array<any> };
  return (
    <div className="relative flex h-svh overflow-hidden">
      <div className="hidden md:block">
        <div className="fixed inset-y-0 left-0">
          <AppSidebarWrapper initialChats={chats as any} currentUserId={userId} />
        </div>
      </div>
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full">
        <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-1 rounded-xl border bg-card/80 px-2 py-1.5 shadow-md backdrop-blur">
          <Link
            to="/dashboard/settings"
            className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex h-full w-full flex-1 flex-col overflow-hidden min-h-0">
          <div className="h-[100svh] grid place-items-center p-4">
            <div className="w-full max-w-2xl space-y-2">
              <ChatPreview className="w-full" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
