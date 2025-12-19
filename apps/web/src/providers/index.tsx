/**
 * App Providers - Clean provider composition
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Toaster } from "sonner";
import { convexClient } from "../lib/convex";
import { authClient } from "../lib/auth-client";
import { ThemeProvider } from "./theme-provider";

// Singleton query client - disable refetch on window focus to prevent tab-switch flashing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Always render the same tree structure to avoid hydration mismatches
  // convexClient is null on server, ConvexBetterAuthProvider handles this
  if (!convexClient) {
    // Server-side or missing env - render without Convex
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="bottom-right" theme="system" />
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return (
    <ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="bottom-right" theme="system" />
        </QueryClientProvider>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  );
}
