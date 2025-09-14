"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function Sidebar({ className, children, defaultCollapsed = false, ...props }: React.ComponentProps<"aside"> & { defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load persisted state
  React.useEffect(() => {
    try {
      const v = localStorage.getItem("oc:sb:collapsed");
      if (v === "1") setCollapsed(true);
      if (v === "0") setCollapsed(false);
    } catch {}
    // avoid animating on first paint
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    const width = collapsed ? "0px" : "16rem"; // expanded width
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sb-width", width);
    }
    try {
      localStorage.setItem("oc:sb:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "bg-background/70 backdrop-blur supports-backdrop-blur:border-border/40 group/sidebar sticky top-0 h-svh w-64 border-r overflow-hidden will-change-transform translate-z-0",
          mounted ? "transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" : "duration-0",
          collapsed ? "-translate-x-full pointer-events-none" : "translate-x-0",
          className,
        )}
        style={{ transitionDuration: mounted ? undefined : "0s" }}
        {...props}
      >
        <div className={cn("flex h-full flex-col", collapsed && "items-center")}>{children}</div>
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
  return <ul className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuButton({ className, asChild, size = "md", ...props }: React.ComponentProps<"button"> & { asChild?: boolean; size?: "md" | "lg" }) {
  const Comp: any = asChild ? "span" : "button";
  return (
    <Comp
      className={cn(
        "text-foreground/90 hover:bg-accent hover:text-accent-foreground inline-flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
        size === "lg" && "px-2 py-2.5 text-base",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("ml-4 mt-1 flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuSubButton({ className, isActive, asChild, ...props }: React.ComponentProps<"button"> & { isActive?: boolean; asChild?: boolean }) {
  const Comp: any = asChild ? "span" : "button";
  return (
    <Comp
      className={cn(
        "hover:bg-accent/70 inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
        isActive && "bg-accent text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarRail({ className, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(SidebarContext);
  const collapsed = !!ctx?.collapsed;
  return (
    <div
      role="button"
      aria-label="Toggle sidebar"
      onClick={() => ctx?.setCollapsed(!collapsed)}
      className={cn(
        collapsed
          ? "hover:bg-accent/40 fixed left-0 top-1/2 z-30 h-10 w-2 -translate-y-1/2 cursor-col-resize rounded-full"
          : "hover:bg-accent/40 absolute right-0 top-1/2 z-10 -mr-2 h-10 w-2 -translate-y-1/2 cursor-col-resize rounded-full",
        "hidden md:block",
        className,
      )}
      {...props}
    />
  );
}
