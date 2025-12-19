/**
 * Command Palette - Keyboard-first navigation (CMD+K / Ctrl+K)
 *
 * Replaces traditional sidebar with a search-driven approach.
 * Features fuzzy search, keyboard navigation, and smooth animations.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUIStore } from "../stores/ui";
import { signOut } from "../lib/auth-client";
import { cn } from "../lib/utils";

// Note: Once routes are created, uncomment this import and update navigation
// import { useNavigate } from "@tanstack/react-router";

// Icons as inline SVGs for simplicity
const SearchIcon = () => (
  <svg
    className="size-5 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="size-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="size-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const LogOutIcon = () => (
  <svg
    className="size-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const ChatIcon = () => (
  <svg
    className="size-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

// Types
interface CommandItem {
  id: string;
  type: "action" | "chat";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

// Mock recent chats data
const mockChats = [
  {
    id: "1",
    title: "Help me write a blog post about AI",
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Debug React component state issue",
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: "3",
    title: "Explain quantum computing basics",
    updatedAt: new Date(Date.now() - 172800000),
  },
  {
    id: "4",
    title: "Review my TypeScript code",
    updatedAt: new Date(Date.now() - 259200000),
  },
  {
    id: "5",
    title: "Create a marketing strategy",
    updatedAt: new Date(Date.now() - 345600000),
  },
  {
    id: "6",
    title: "Brainstorm startup ideas",
    updatedAt: new Date(Date.now() - 432000000),
  },
];

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// Fuzzy search implementation
function fuzzyMatch(text: string, query: string): boolean {
  const searchLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Direct substring match
  if (textLower.includes(searchLower)) return true;

  // Fuzzy character matching
  let searchIndex = 0;
  for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++;
    }
  }
  return searchIndex === searchLower.length;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command items
  // Note: Using window.location for routes that don't exist yet in the route tree
  // These will be updated to use navigate() once the routes are created
  const allItems = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: "new-chat",
        type: "action",
        title: "New Chat",
        icon: <PlusIcon />,
        keywords: ["create", "start", "new", "chat"],
        action: () => {
          setCommandPaletteOpen(false);
          // TODO: Update to navigate({ to: "/chat/new" }) once route exists
          window.location.href = "/chat/new";
        },
      },
      {
        id: "settings",
        type: "action",
        title: "Settings",
        icon: <SettingsIcon />,
        keywords: ["preferences", "config", "options"],
        action: () => {
          setCommandPaletteOpen(false);
          // TODO: Update to navigate({ to: "/settings" }) once route exists
          window.location.href = "/settings";
        },
      },
      {
        id: "sign-out",
        type: "action",
        title: "Sign Out",
        icon: <LogOutIcon />,
        keywords: ["logout", "exit", "leave"],
        action: () => {
          setCommandPaletteOpen(false);
          signOut();
        },
      },
    ];

    const chats: CommandItem[] = mockChats.map((chat) => ({
      id: `chat-${chat.id}`,
      type: "chat",
      title: chat.title,
      subtitle: formatRelativeTime(chat.updatedAt),
      icon: <ChatIcon />,
      action: () => {
        setCommandPaletteOpen(false);
        // TODO: Update to navigate({ to: "/chat/$id", params: { id: chat.id } }) once route exists
        window.location.href = `/chat/${chat.id}`;
      },
    }));

    return [...actions, ...chats];
  }, [setCommandPaletteOpen]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;

    return allItems.filter((item) => {
      if (fuzzyMatch(item.title, query)) return true;
      if (item.keywords?.some((k) => fuzzyMatch(k, query))) return true;
      return false;
    });
  }, [allItems, query]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const actions = filteredItems.filter((item) => item.type === "action");
    const chats = filteredItems.filter((item) => item.type === "chat");
    return { actions, chats };
  }, [filteredItems]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle open/close animation state machine
  useEffect(() => {
    if (commandPaletteOpen && !isVisible) {
      // Opening: make visible immediately
      setIsVisible(true);
      setIsClosing(false);
    } else if (!commandPaletteOpen && isVisible && !isClosing) {
      // Closing: trigger exit animation, then unmount
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 150); // Match animation duration
      return () => clearTimeout(timer);
    }
    // NOTE: isClosing intentionally omitted from deps to prevent the effect
    // from re-running and clearing the close timer when isClosing changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandPaletteOpen, isVisible]);

  // Focus input when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [commandPaletteOpen]);

  // Lock body scroll when palette is open
  useEffect(() => {
    if (isVisible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isVisible]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Global keyboard navigation - works regardless of focus
  useEffect(() => {
    if (!isVisible) return;

    function handleGlobalKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          setCommandPaletteOpen(false);
          break;
      }
    }

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isVisible, filteredItems, selectedIndex, setCommandPaletteOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setCommandPaletteOpen(false);
      }
    },
    [setCommandPaletteOpen]
  );

  // Get flat index for an item
  const getFlatIndex = (type: "action" | "chat", localIndex: number): number => {
    if (type === "action") return localIndex;
    return groupedItems.actions.length + localIndex;
  };

  // Don't render if not visible
  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh]"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm",
          isClosing
            ? "animate-out fade-out duration-150"
            : "animate-in fade-in duration-150"
        )}
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-xl mx-4 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden",
          isClosing
            ? "animate-out fade-out zoom-out-95 slide-out-to-top-2 duration-150"
            : "animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats or type a command..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto overscroll-contain py-2"
        >
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <>
              {/* Actions section */}
              {groupedItems.actions.length > 0 && (
                <div className="px-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </div>
                  {groupedItems.actions.map((item, localIndex) => {
                    const flatIndex = getFlatIndex("action", localIndex);
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === flatIndex}
                        dataIndex={flatIndex}
                        onSelect={() => item.action()}
                        onHover={() => setSelectedIndex(flatIndex)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Chats section */}
              {groupedItems.chats.length > 0 && (
                <div className="px-2 mt-2">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recent Chats
                  </div>
                  {groupedItems.chats.map((item, localIndex) => {
                    const flatIndex = getFlatIndex("chat", localIndex);
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === flatIndex}
                        dataIndex={flatIndex}
                        onSelect={() => item.action()}
                        onHover={() => setSelectedIndex(flatIndex)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                ↵
              </kbd>
              <span>Select</span>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual command item component
function CommandItem({
  item,
  isSelected,
  dataIndex,
  onSelect,
  onHover,
}: {
  item: CommandItem;
  isSelected: boolean;
  dataIndex: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      data-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
        isSelected
          ? "bg-primary/10 text-foreground"
          : "bg-transparent text-foreground/80 hover:bg-transparent"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center size-8 rounded-lg transition-colors pointer-events-none",
          isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {item.icon}
      </span>
      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="truncate text-sm font-medium">{item.title}</div>
        {item.subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {item.subtitle}
          </div>
        )}
      </div>
      {isSelected && (
        <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground pointer-events-none">
          ↵
        </kbd>
      )}
    </button>
  );
}

/**
 * Global keyboard shortcut listener for command palette
 * Should be used in the root layout
 */
export function useCommandPaletteShortcut() {
  const { toggleCommandPalette } = useUIStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // CMD+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleCommandPalette]);
}
