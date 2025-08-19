import type { Metadata } from "next";
import "../index.css";
import { ThemeProvider } from "@/components/theme-provider-simple";

export const metadata: Metadata = {
  title: {
    template: 'OpenChat - %s',
    default: 'OpenChat',
  },
  description: "AI-powered chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
