"use client";

import dynamicImport from "next/dynamic";
import type { AppSidebarProps } from "@/components/app-sidebar";
import { AppSidebarSkeleton } from "@/components/skeletons/sidebar-skeleton";

// Dynamically import AppSidebar with ssr: false to prevent server-side rendering
// This is necessary because AppSidebar uses useOpenRouterKey hook which requires ConvexProvider
// PERFORMANCE: Dynamic import reduces initial bundle and speeds up dev compilation
const AppSidebar = dynamicImport(() => import("@/components/app-sidebar"), {
  ssr: false,
  loading: () => <AppSidebarSkeleton />,
});

export default function AppSidebarWrapper(props: AppSidebarProps) {
  return <AppSidebar {...props} />;
}
