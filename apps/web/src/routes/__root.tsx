import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Providers } from "../providers";
import { CommandPalette, useCommandPaletteShortcut } from "../components/command-palette";
import { SidebarProvider, SidebarInset, useSidebarShortcut } from "../components/ui/sidebar";
import { AppSidebar } from "../components/app-sidebar";
import { useAuth } from "../lib/auth-client";
import { usePostHogPageView } from "../providers/posthog";
import { convexClient } from "../lib/convex";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "OpenChat" },
      { name: "description", content: "AI Chat powered by OpenRouter" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
    scripts: [
      {
        children: `
          (function() {
            const stored = localStorage.getItem('openchat-theme');
            const theme = stored === 'dark' || stored === 'light' ? stored :
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.classList.add(theme);
          })();
        `,
      },
      {
        src: "https://assets.onedollarstats.com/stonks.js",
        defer: true,
      },
    ],
  }),

  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Providers>
        <AppShell />
      </Providers>
    </RootDocument>
  );
}

function AppShell() {
  // Register global keyboard shortcuts
  useCommandPaletteShortcut();
  useSidebarShortcut();

  // Track page views
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  usePostHogPageView(pathname);

  const { isAuthenticated, loading } = useAuth();

  if (!convexClient || loading) {
    return (
      <div className="flex h-screen w-full bg-sidebar">
        <div className="w-64 shrink-0 bg-sidebar" />
        <div className="flex-1 bg-background" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Outlet />
        <CommandPalette />
      </>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-sidebar">
        <AppSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="h-full overflow-hidden bg-background antialiased" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
