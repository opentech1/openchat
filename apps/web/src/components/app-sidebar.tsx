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
import { useAuth } from "@clerk/nextjs";
import { connect, subscribe, unsubscribe, type Envelope } from "@/lib/sync";
type ChatListItem = { id: string; title: string | null; updatedAt?: string | Date; lastMessageAt?: string | Date | null };
type AppSidebarProps = { initialChats?: ChatListItem[] } & React.ComponentProps<typeof Sidebar>;

export default function AppSidebar({ initialChats = [] }: AppSidebarProps) {
  const auth = useAuth();
  const userId = auth.userId || (typeof window !== "undefined" ? ((window as any).__DEV_USER_ID__ as string | undefined) : undefined) || null;
  const [chats, setChats] = React.useState(() => (initialChats || []).map((c) => ({
    ...c,
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
    lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt as any) : null,
  })));

  React.useEffect(() => {
    // ensure socket up
    void connect();
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    const topic = `chats:index:${userId}`;
    const handler = (evt: Envelope) => {
      if (evt.type === "chats.index.add") {
        const d = evt.data as any;
        setChats((prev) => {
          if (prev.some((c) => c.id === d.chatId)) return prev;
          const next = prev.concat([{ id: d.chatId, title: d.title ?? "New Chat", updatedAt: new Date(d.updatedAt), lastMessageAt: d.lastMessageAt ? new Date(d.lastMessageAt) : null }]);
          return sortChats(next);
        });
      } else if (evt.type === "chats.index.update") {
        const d = evt.data as any;
        setChats((prev) => {
          const next = prev.map((c) => c.id === d.chatId ? ({ ...c, updatedAt: new Date(d.updatedAt), lastMessageAt: d.lastMessageAt ? new Date(d.lastMessageAt) : null, title: d.title ?? c.title }) : c);
          return sortChats(next);
        });
      }
    };
    const off = subscribe(topic, handler);
    return () => {
      off();
    };
  }, [userId]);

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
          <ChatList chats={chats} />
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto w-full px-2 pb-3 pt-2">
        <div className="flex items-center justify-between rounded-md px-2 py-1.5">
          <span className="text-xs text-muted-foreground">Account</span>
          {process.env.NODE_ENV === "test" ? null : <UserButton afterSignOutUrl="/" userProfileMode="modal" />}
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

function sortChats(list: ChatListItem[]) {
  const copy = list.slice();
  copy.sort((a, b) => {
    const aLast = (a.lastMessageAt ? new Date(a.lastMessageAt) : (a.updatedAt ? new Date(a.updatedAt) : new Date(0))).getTime();
    const bLast = (b.lastMessageAt ? new Date(b.lastMessageAt) : (b.updatedAt ? new Date(b.updatedAt) : new Date(0))).getTime();
    if (bLast !== aLast) return bLast - aLast;
    const aUp = (a.updatedAt ? new Date(a.updatedAt) : new Date(0)).getTime();
    const bUp = (b.updatedAt ? new Date(b.updatedAt) : new Date(0)).getTime();
    return bUp - aUp;
  });
  return copy;
}
