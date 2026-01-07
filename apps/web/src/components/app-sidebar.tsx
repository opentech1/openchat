import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useAuth } from "@/lib/auth-client";
import { convexClient } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/sidebar";
import { PlusIcon, ChatIcon, SidebarIcon, ChevronRightIcon } from "@/components/icons";
import type { Id } from "@server/convex/_generated/dataModel";

const CHATS_CACHE_KEY = "openchat-chats-cache";

interface ChatItem {
  _id: Id<"chats">;
  title: string;
  updatedAt: number;
  status?: string;
}

// Skeleton for loading chat items
function ChatItemSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <div className="size-4 rounded bg-sidebar-foreground/10 animate-pulse" />
      <div className="h-4 flex-1 rounded bg-sidebar-foreground/10 animate-pulse" />
    </div>
  );
}

function groupChatsByTime(chats: ChatItem[]) {
  const today: ChatItem[] = [];
  const last7Days: ChatItem[] = [];
  const last30Days: ChatItem[] = [];
  const older: ChatItem[] = [];

  const now = Date.now();
  const oneDayMs = 1000 * 60 * 60 * 24;

  for (const chat of chats) {
    const diffDays = Math.floor((now - chat.updatedAt) / oneDayMs);

    if (diffDays === 0) {
      today.push(chat);
    } else if (diffDays < 7) {
      last7Days.push(chat);
    } else if (diffDays < 30) {
      last30Days.push(chat);
    } else {
      older.push(chat);
    }
  }

  return { today, last7Days, last30Days, older };
}

interface ChatGroupProps {
  label: string;
  chats: ChatItem[];
  currentChatId?: string;
  onChatClick: (chatId: string) => void;
}

function ChatGroup({ label, chats, currentChatId, onChatClick }: ChatGroupProps) {
  if (chats.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {chats.map((chat) => (
          <SidebarMenuItem key={chat._id}>
            <SidebarMenuButton
              isActive={currentChatId === chat._id}
              onClick={() => onChatClick(chat._id)}
            >
              <ChatIcon />
              <span className="truncate">{chat.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { user } = useAuth();
  const { open, isMobile, setOpen } = useSidebar();
  const navigate = useNavigate();

  // Get current chat ID from URL if we're on a chat page
  let currentChatId: string | undefined;
  try {
    const params = useParams({ from: "/c/$chatId", shouldThrow: false });
    currentChatId = params?.chatId;
  } catch {
    // Not on a chat page
  }

  // First, get the Convex user by Better Auth external ID
  // Skip if Convex client is not available (prevents SSR errors)
  const convexUser = useQuery(
    api.users.getByExternalId,
    convexClient && user?.id ? { externalId: user.id } : "skip",
  );

  const chatsResult = useQuery(
    api.chats.list,
    convexClient && convexUser?._id ? { userId: convexUser._id } : "skip",
  );

  const cachedChatsRef = useRef<ChatItem[] | null>(null);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(CHATS_CACHE_KEY);
      if (stored && !cachedChatsRef.current) {
        cachedChatsRef.current = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load chats from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    if (chatsResult?.chats && chatsResult.chats.length > 0) {
      cachedChatsRef.current = chatsResult.chats;
      try {
        localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(chatsResult.chats));
      } catch (e) {
        console.warn("Failed to save chats to localStorage:", e);
      }
    }
  }, [chatsResult?.chats]);

  const chats = chatsResult?.chats ?? cachedChatsRef.current ?? [];
  
  const hasCachedChats = chats.length > 0;
  
  const isLoadingChats = user?.id && !hasCachedChats
    ? convexUser === undefined || chatsResult === undefined
    : false;
    
  const grouped = groupChatsByTime(chats);

  const handleNewChat = () => {
    if (isMobile) {
      setOpen(false);
    }
    navigate({ to: "/" });
  };

  const handleChatClick = (chatId: string) => {
    if (isMobile) {
      setOpen(false);
    }
    navigate({ to: "/c/$chatId", params: { chatId } });
  };

  return (
    <>
      {/* Collapsed floating bar - aligns with sidebar header */}
      <div
        className={cn(
          "fixed left-3 top-3 z-50 flex items-center gap-1 rounded-xl bg-sidebar/95 p-1 shadow-lg ring-1 ring-sidebar-border/50 backdrop-blur-sm",
          "transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          open && !isMobile
            ? "pointer-events-none opacity-0 scale-95"
            : !isMobile
              ? "opacity-100 scale-100"
              : "pointer-events-none opacity-0 scale-95",
        )}
      >
        <button
          onClick={() => setOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="Open sidebar"
        >
          <SidebarIcon />
        </button>
        <button
          onClick={handleNewChat}
          className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title="New Chat"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Main sidebar */}
      <Sidebar>
        {/* Header: Toggle button left, Logo centered */}
        <div className="relative flex h-14 shrink-0 items-center justify-center px-3">
          {/* Toggle button - absolute positioned left */}
          <button
            onClick={() => setOpen(false)}
            className="absolute left-3 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Close sidebar"
          >
            <SidebarIcon />
          </button>

          {/* Logo - centered */}
          <button
            onClick={handleNewChat}
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <span className="text-xl font-bold tracking-tight text-sidebar-foreground">
              oss<span className="text-sidebar-primary">chat</span>
            </span>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="shrink-0 px-3 pb-3">
          <Button onClick={handleNewChat} className="w-full justify-center gap-2" variant="default">
            New Chat
          </Button>
        </div>

        {/* Chat History - scrollable area that takes remaining space */}
        <SidebarContent className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
          {isLoadingChats ? (
            <div className="px-3 py-2 space-y-1">
              <ChatItemSkeleton />
              <ChatItemSkeleton />
              <ChatItemSkeleton />
              <ChatItemSkeleton />
            </div>
          ) : chats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/50">
              No chats yet
            </div>
          ) : (
            <>
              <ChatGroup label="Today" chats={grouped.today} currentChatId={currentChatId} onChatClick={handleChatClick} />
              <ChatGroup label="Last 7 days" chats={grouped.last7Days} currentChatId={currentChatId} onChatClick={handleChatClick} />
              <ChatGroup label="Last 30 days" chats={grouped.last30Days} currentChatId={currentChatId} onChatClick={handleChatClick} />
              <ChatGroup label="Older" chats={grouped.older} currentChatId={currentChatId} onChatClick={handleChatClick} />
            </>
          )}
        </SidebarContent>

        {/* Footer with Profile Card - always visible, sticky at bottom */}
        <SidebarFooter className="shrink-0 border-t border-sidebar-border/50 p-3">
          {user && (
            <button
              onClick={() => {
                if (isMobile) setOpen(false);
                navigate({ to: "/settings" });
              }}
              className="group flex w-full items-center gap-3 rounded-xl bg-sidebar-accent/40 px-3 py-3 transition-all hover:bg-sidebar-accent/70 focus:outline-none"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="size-10 shrink-0 rounded-full ring-2 ring-sidebar-primary/20"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-base font-semibold text-sidebar-primary-foreground ring-2 ring-sidebar-primary/20">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold text-sidebar-foreground">
                  {user.name || "User"}
                </div>
                <div className="truncate text-xs text-sidebar-foreground/50">Settings</div>
              </div>
              <ChevronRightIcon />
            </button>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
