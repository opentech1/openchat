import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "../index.css";
import { ThemeProvider } from "@/components/theme-provider-simple";
import { ClientLayout } from "@/components/client-layout";

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
          <ClientLayout defaultSidebarOpen={defaultOpen}>
            {children}
          </ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
