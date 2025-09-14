"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

export default function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar defaultCollapsed {...props}>
      <SidebarHeader className="px-2 py-3">
        <div className="flex items-center justify-center">
          <Link href="/dashboard" className={cn("select-none text-lg font-semibold tracking-tight md:text-xl leading-none")}>OpenChat</Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Button asChild variant="outline" className="w-full justify-center">
            <Link href="/dashboard/new">New Chat</Link>
          </Button>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2">
        <div className="flex items-center justify-between rounded-md px-2 py-1.5">
          <span className="text-xs text-muted-foreground">Account</span>
          <UserButton afterSignOutUrl="/" userProfileMode="modal" />
        </div>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
