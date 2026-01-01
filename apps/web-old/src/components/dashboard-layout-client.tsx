"use client";

import type { ReactNode } from "react";
import DashboardLayoutInner from "@/components/dashboard-layout-inner";

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
