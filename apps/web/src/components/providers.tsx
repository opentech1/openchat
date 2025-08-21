"use client";

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";
import { DatabaseProvider } from "./database-provider";

interface ProvidersProps {
  children: React.ReactNode;
  userId?: string;
}

export default function Providers({ children, userId }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DatabaseProvider userId={userId}>
        {children}
        <ReactQueryDevtools />
      </DatabaseProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
