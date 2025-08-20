import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "../index.css";
import { ThemeProvider } from "@/components/theme-provider-simple";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import LoginModal from "@/components/login-modal";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    template: 'OpenChat - %s',
    default: 'OpenChat',
  },
  description: "AI-powered chat application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans h-screen overflow-hidden`}>
        <ThemeProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <div className="flex h-full w-full">
              <AppSidebar />
              <div className="flex-1 flex flex-col min-h-0">
                <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
                  <SidebarTrigger />
                  <div className="flex items-center gap-2">
                    <LoginModal />
                  </div>
                </header>
                <main className="flex-1 overflow-y-auto overflow-x-hidden">
                  {children}
                </main>
              </div>
            </div>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
