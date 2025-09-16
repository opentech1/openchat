import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-server";
import AppSidebar from "@/components/app-sidebar";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";
import { Settings } from "lucide-react";
import { serverClient } from "@/utils/orpc-server";
import Providers from "@/components/providers";
import OptionalClerkProvider from "@/lib/optional-clerk";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect("/auth/sign-in");

  const chats = await serverClient.chats.list().catch(() => []);

  return (
    <OptionalClerkProvider>
      <Providers>
        <div className="relative flex min-h-svh overflow-hidden">
          <div className="hidden md:block">
            <div className="fixed inset-y-0 left-0">
              <AppSidebar initialChats={chats} />
            </div>
          </div>
          <main className="relative flex-1 md:ml-[var(--sb-width)] transition-[margin] duration-300 ease-in-out w-full">
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
            <div className="h-full w-full">
              {children}
            </div>
          </main>
        </div>
      </Providers>
    </OptionalClerkProvider>
  );
}
