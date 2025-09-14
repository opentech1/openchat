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
type ChatListItem = { id: string; title: string | null };
type AppSidebarProps = { initialChats?: ChatListItem[] } & React.ComponentProps<typeof Sidebar>;

export default function AppSidebar({ initialChats = [] }: AppSidebarProps) {
  return (
    <Sidebar defaultCollapsed>
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
        <SidebarGroup>
          <h3 className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Chats</h3>
          <ChatList chats={initialChats} />
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

function ChatList({ chats }: { chats: ChatListItem[] }) {
  const items = chats ?? [];
  if (items.length === 0) return <p className="px-2 text-xs text-muted-foreground">No chats</p>;
  return (
    <ul className="px-1">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/dashboard/chat/${c.id}`}
            className="hover:bg-accent hover:text-accent-foreground block truncate rounded-md px-2 py-1.5 text-sm"
          >
            {c.title || "Untitled"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
