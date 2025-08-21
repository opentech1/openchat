"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/utils/orpc";
import { AuthenticatedApp } from './authenticated-app';

interface ClientLayoutProps {
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
}

export function ClientLayout({ children, defaultSidebarOpen = false }: ClientLayoutProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp defaultSidebarOpen={defaultSidebarOpen}>
        {children}
      </AuthenticatedApp>
    </QueryClientProvider>
  );
}