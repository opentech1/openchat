"use client";

import type { ReactNode } from "react";
import dynamicImport from "next/dynamic";
import { LoaderIcon } from "lucide-react";

// Dynamically import the inner dashboard layout with ssr: false
// This ensures all Convex hooks are only called client-side where ConvexProvider is available
const DashboardLayoutInner = dynamicImport(
  () => import("@/components/dashboard-layout-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-svh items-center justify-center">
        <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

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
  return <DashboardLayoutInner chats={chats}>{children}</DashboardLayoutInner>;
}
