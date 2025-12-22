/**
 * App Sidebar - Premium sidebar with smooth collapse animation
 */

import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useAuth, signOut } from "@/lib/auth-client";
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

// Icons
const PlusIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
  </svg>
);

const ChatIcon = () => (
  <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

// Sidebar panel icon (clean, modern design)
const SidebarIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
    <path d="M9 3v18" strokeWidth={1.5} />
  </svg>
);

// Group chats by time periods
interface ChatItem {
  _id: string;
  title: string;
  updatedAt: number;
  status?: string;
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
  const convexUser = useQuery(
    api.users.getByExternalId,
    user?.id ? { externalId: user.id } : "skip"
  );

  // Then fetch chat history using the Convex user ID
  const chatsResult = useQuery(
    api.chats.list,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );

  const chats = chatsResult?.chats ?? [];
  const grouped = groupChatsByTime(chats as unknown as ChatItem[]);

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

  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      {/* Collapsed floating bar - pixel-perfect alignment with sidebar toggle */}
      <div
        className={cn(
          "fixed left-2 top-2 z-50 flex items-center rounded-xl bg-sidebar/95 p-1 shadow-lg ring-1 ring-sidebar-border/50 backdrop-blur-sm transition-opacity duration-150",
          open && !isMobile
            ? "pointer-events-none opacity-0"
            : !isMobile
              ? "opacity-100"
              : "pointer-events-none opacity-0"
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
        {/* Header: Toggle LEFT, Logo CENTERED */}
        <div className="relative flex h-[52px] items-center justify-center px-3">
          {/* Toggle button - positioned to align exactly with collapsed bar button */}
          <button
            onClick={() => setOpen(false)}
            className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Close sidebar"
          >
            <SidebarIcon />
          </button>

          {/* Logo - centered */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          >
            <span className="text-base font-semibold text-sidebar-foreground">
              oss<span className="text-sidebar-primary">chat</span>
            </span>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-2">
          <Button
            onClick={handleNewChat}
            className="w-full justify-center gap-2"
            variant="default"
          >
            New Chat
          </Button>
        </div>

        {/* Chat History */}
        <SidebarContent className="scrollbar-none">
          {chats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/50">
              No chats yet
            </div>
          ) : (
            <>
              {grouped.today.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Today</SidebarGroupLabel>
                  <SidebarMenu>
                    {grouped.today.map((chat) => (
                      <SidebarMenuItem key={chat._id}>
                        <SidebarMenuButton
                          isActive={currentChatId === chat._id}
                          onClick={() => handleChatClick(chat._id)}
                        >
                          <ChatIcon />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )}

              {grouped.last7Days.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Last 7 days</SidebarGroupLabel>
                  <SidebarMenu>
                    {grouped.last7Days.map((chat) => (
                      <SidebarMenuItem key={chat._id}>
                        <SidebarMenuButton
                          isActive={currentChatId === chat._id}
                          onClick={() => handleChatClick(chat._id)}
                        >
                          <ChatIcon />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )}

              {grouped.last30Days.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Last 30 days</SidebarGroupLabel>
                  <SidebarMenu>
                    {grouped.last30Days.map((chat) => (
                      <SidebarMenuItem key={chat._id}>
                        <SidebarMenuButton
                          isActive={currentChatId === chat._id}
                          onClick={() => handleChatClick(chat._id)}
                        >
                          <ChatIcon />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )}

              {grouped.older.length > 0 && (
                <SidebarGroup>
                  <SidebarGroupLabel>Older</SidebarGroupLabel>
                  <SidebarMenu>
                    {grouped.older.map((chat) => (
                      <SidebarMenuItem key={chat._id}>
                        <SidebarMenuButton
                          isActive={currentChatId === chat._id}
                          onClick={() => handleChatClick(chat._id)}
                        >
                          <ChatIcon />
                          <span className="truncate">{chat.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )}
            </>
          )}
        </SidebarContent>

        {/* Footer with Profile */}
        <SidebarFooter className="p-3">
          {user && (
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-sidebar-accent/50"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="size-8 shrink-0 rounded-full"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.name || "User"}
                </div>
              </div>
            </button>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
