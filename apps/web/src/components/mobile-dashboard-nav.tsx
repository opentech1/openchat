"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import AppSidebarWrapper from "@/components/app-sidebar-wrapper";
import type { AppSidebarProps } from "@/components/app-sidebar";
import { opacity, iconSize } from "@/styles/design-tokens";
export default function MobileDashboardNav(props: AppSidebarProps) {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		if (!open) return;
		const original = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = original;
		};
	}, [open]);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`md:hidden inline-flex size-9 items-center justify-center rounded-md border border-border/60 bg-card/${opacity.subtle} text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground`}
				aria-label="Open chat navigation"
			>
				<Menu className={iconSize.sm} />
			</button>
			{open ? (
				<div className="fixed inset-0 z-40 md:hidden animate-in fade-in duration-200">
					<div className="absolute inset-0 bg-background/60 backdrop-blur animate-in fade-in duration-200" onClick={() => setOpen(false)} aria-hidden />
					<div className="absolute inset-y-0 right-0 flex h-full w-full max-w-xs flex-col animate-in slide-in-from-right duration-300">
						<div className="flex items-center justify-end px-4 py-3">
							<button
								type="button"
								onClick={() => setOpen(false)}
								className={`inline-flex size-9 items-center justify-center rounded-md border border-border/60 bg-card/${opacity.subtle} text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground`}
								aria-label="Close chat navigation"
							>
								<X className={iconSize.sm} />
							</button>
						</div>
					<div className="ml-auto h-full w-full max-w-xs border-l border-sidebar-border bg-sidebar shadow-xl">
							<AppSidebarWrapper {...props} />
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
