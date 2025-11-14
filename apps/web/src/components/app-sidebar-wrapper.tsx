"use client";

import dynamicImport from "next/dynamic";
import type { AppSidebarProps } from "@/components/app-sidebar";

// Dynamically import AppSidebar with ssr: false to prevent server-side rendering
// This is necessary because AppSidebar uses useOpenRouterKey hook which requires ConvexProvider
const AppSidebar = dynamicImport(() => import("@/components/app-sidebar"), {
  ssr: false,
  loading: () => <SidebarSkeleton />,
});

function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col justify-between border-r bg-background">
      <div className="p-4 text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

export default function AppSidebarWrapper(props: AppSidebarProps) {
  return <AppSidebar {...props} />;
}
