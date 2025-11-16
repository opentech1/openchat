"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { spacing } from "@/styles/design-tokens";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a Sidebar component");
  }
  return context;
}

export function Sidebar({ className, children, defaultCollapsed = false, ...props }: React.ComponentProps<"aside"> & { defaultCollapsed?: boolean }) {
	// State management with localStorage persistence
	const [collapsed, setCollapsedState] = React.useState(() => {
		if (typeof window === "undefined") return defaultCollapsed;
		const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED);
		// If no stored value, use defaultCollapsed (false for new users = auto-open)
		if (stored === null) return defaultCollapsed;
		return stored === "1";
	});

	const setCollapsed = React.useCallback((value: boolean) => {
		setCollapsedState(value);
		if (typeof window !== "undefined") {
			localStorage.setItem(LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED, value ? "1" : "0");
		}
	}, []);

	// Update CSS variable for sidebar width
	React.useEffect(() => {
		if (typeof document !== "undefined") {
			const width = collapsed ? "0rem" : "16rem";
			document.documentElement.style.setProperty("--sb-width", width);
		}
	}, [collapsed]);

	// Keyboard shortcut (Cmd/Ctrl+B)
	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "b") {
				e.preventDefault();
				setCollapsed((prev) => !prev);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [setCollapsed]);

	const contextValue = React.useMemo(
		() => ({ collapsed, setCollapsed }),
		[collapsed, setCollapsed]
	);

  return (
    <SidebarContext.Provider value={contextValue}>
      <aside
		className={cn(
			// Light mode now uses dedicated sidebar tokens so the chrome stays legible without feeling stark.
			"bg-sidebar/95 text-sidebar-foreground backdrop-blur supports-backdrop-blur:border-sidebar-border/50 group/sidebar sticky top-0 h-svh border-r border-sidebar-border/80 overflow-hidden translate-z-0 transition-all duration-300 ease-in-out",
			collapsed ? "w-0 border-r-0" : "w-64",
          className,
        )}
        {...props}
      >
        <div className="flex h-full flex-col">{children}</div>
      </aside>
    </SidebarContext.Provider>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-3 py-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 space-y-2 overflow-y-auto px-2", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col", spacing.gap.xs, className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuButton({ className, asChild, size = "md", type = "button", ...props }: React.ComponentProps<"button"> & { asChild?: boolean; size?: "md" | "lg" }) {
	const Comp: React.ElementType = asChild ? Slot : "button";
	return (
		<Comp
			className={cn(
				"text-foreground/90 hover:bg-accent hover:text-accent-foreground inline-flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors",
				spacing.gap.sm,
				size === "lg" && "px-2 py-2.5 text-base",
				className,
			)}
			{...(asChild ? {} : { type })}
			{...props}
		/>
	);
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("ml-4 mt-1 flex flex-col", spacing.gap.xs, className)} {...props} />;
}

export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuSubButton({ className, isActive, asChild, type = "button", ...props }: React.ComponentProps<"button"> & { isActive?: boolean; asChild?: boolean }) {
	const Comp: React.ElementType = asChild ? Slot : "button";
	return (
		<Comp
			className={cn(
				"hover:bg-accent/70 inline-flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
				spacing.gap.sm,
				isActive && "bg-accent text-accent-foreground",
				className,
			)}
			{...(asChild ? {} : { type })}
			{...props}
		/>
	);
}

export function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
	const { collapsed, setCollapsed } = useSidebar();

	return (
		<button
			type="button"
			onClick={() => setCollapsed(!collapsed)}
			className={cn(
				"fixed z-30 flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-md transition-all hover:bg-accent hover:text-accent-foreground",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				collapsed ? "left-4 top-4" : "left-60 top-4",
				className
			)}
			aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
			title={collapsed ? "Open sidebar (Cmd+B)" : "Close sidebar (Cmd+B)"}
			{...props}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{collapsed ? (
					// Menu icon (hamburger)
					<>
						<line x1="4" y1="6" x2="20" y2="6" />
						<line x1="4" y1="12" x2="20" y2="12" />
						<line x1="4" y1="18" x2="20" y2="18" />
					</>
				) : (
					// Chevron left (close)
					<>
						<polyline points="15 18 9 12 15 6" />
					</>
				)}
			</svg>
		</button>
	);
}
