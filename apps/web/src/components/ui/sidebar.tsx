"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Separator } from "./separator";
import { useUIStore } from "@/stores/ui";

// ============================================================================
// Context
// ============================================================================

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface SidebarProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  defaultCollapsed?: boolean;
}

function SidebarProvider({
  children,
  defaultOpen = true,
  defaultCollapsed = false,
}: SidebarProviderProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useUIStore();

  const [isMobile, setIsMobile] = React.useState(false);

  // Initialize from store or defaults
  React.useEffect(() => {
    if (sidebarOpen === undefined) {
      setSidebarOpen(defaultOpen);
    }
    if (sidebarCollapsed === undefined) {
      setSidebarCollapsed(defaultCollapsed);
    }
  }, [defaultOpen, defaultCollapsed, sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed]);

  // Handle responsive breakpoint
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close on mobile
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <SidebarContext.Provider
      value={{
        open: sidebarOpen,
        setOpen: setSidebarOpen,
        collapsed: sidebarCollapsed,
        setCollapsed: setSidebarCollapsed,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// ============================================================================
// Sidebar Root
// ============================================================================

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
}

function Sidebar({
  side = "left",
  className,
  children,
  ...props
}: SidebarProps) {
  const { open, isMobile } = useSidebar();

  // Mobile: render as overlay/drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => useUIStore.getState().setSidebarOpen(false)}
          />
        )}
        {/* Drawer */}
        <aside
          data-slot="sidebar"
          data-state={open ? "open" : "closed"}
          data-side={side}
          className={cn(
            "fixed inset-y-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-150 ease-out",
            side === "left" ? "left-0" : "right-0",
            open
              ? "translate-x-0"
              : side === "left"
                ? "-translate-x-full"
                : "translate-x-full",
            className
          )}
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }

  // Desktop: fully hide/show sidebar (offcanvas style)
  return (
    <aside
      data-slot="sidebar"
      data-state={open ? "open" : "closed"}
      data-side={side}
      className={cn(
        "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground border-sidebar-border transition-all duration-150 ease-out overflow-hidden",
        side === "left" ? "border-r" : "border-l",
        open ? "w-64" : "w-0 border-0",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

// ============================================================================
// Sidebar Header
// ============================================================================

function SidebarHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Content
// ============================================================================

function SidebarContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Footer
// ============================================================================

function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Group
// ============================================================================

function SidebarGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Group Label
// ============================================================================

function SidebarGroupLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-3 py-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Menu
// ============================================================================

function SidebarMenu({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

// ============================================================================
// Sidebar Menu Item
// ============================================================================

function SidebarMenuItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    >
      {children}
    </li>
  );
}

// ============================================================================
// Sidebar Menu Button
// ============================================================================

const sidebarMenuButtonVariants = cva(
  "group/menu-button relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 outline-none",
  {
    variants: {
      variant: {
        default: "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        active: [
          "bg-sidebar-accent/80 text-sidebar-foreground",
          "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
          "before:h-5 before:w-1 before:rounded-full before:bg-sidebar-primary",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className, variant, isActive, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        sidebarMenuButtonVariants({
          variant: isActive ? "active" : variant,
        }),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

// ============================================================================
// Sidebar Trigger
// ============================================================================

interface SidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

function SidebarTrigger({ className, ...props }: SidebarTriggerProps) {
  const { open, setOpen } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0", className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      <svg
        className="size-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={open ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" : "M13 5l7 7-7 7M5 5l7 7-7 7"}
        />
      </svg>
      <span className="sr-only">Toggle sidebar</span>
    </Button>
  );
}

// ============================================================================
// Sidebar Inset (Main content area)
// ============================================================================

function SidebarInset({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      {children}
    </main>
  );
}

// ============================================================================
// Sidebar Separator
// ============================================================================

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      className={cn("mx-4 my-2 bg-sidebar-border", className)}
      {...props}
    />
  );
}

// ============================================================================
// Keyboard Shortcut Hook
// ============================================================================

/**
 * Global keyboard shortcut listener for sidebar toggle
 * CMD+B (Mac) or Ctrl+B (Windows/Linux)
 * Should be used in the root layout
 */
function useSidebarShortcut() {
  const { toggleSidebar } = useUIStore();

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // CMD+B (Mac) or Ctrl+B (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [toggleSidebar]);
}

// ============================================================================
// Exports
// ============================================================================

export {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
  useSidebar,
  useSidebarShortcut,
};
