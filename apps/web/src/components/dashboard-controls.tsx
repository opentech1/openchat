"use client";

import { useCallback, useEffect, useState } from "react";
import SidebarCollapseButton from "@/components/sidebar-collapse-button";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { opacity, spacing } from "@/styles/design-tokens";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";

export function DashboardControls() {
	const { open, setOpen } = useCommandPalette();
	// Start with false to match server render and avoid hydration mismatch
	const [collapsed, setCollapsed] = useState(false);

	const updateCollapsedState = useCallback(() => {
		try {
			const value = localStorage.getItem(LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED);
			setCollapsed(value === "1");
		} catch {
			setCollapsed(false);
		}
	}, []);

	useEffect(() => {
		// Load from localStorage after mount
		updateCollapsedState();

		const handleStorage = (e: StorageEvent) => {
			if (e.key === LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED) {
				updateCollapsedState();
			}
		};

		const handleSidebarToggle = () => {
			updateCollapsedState();
		};

		window.addEventListener("storage", handleStorage);
		window.addEventListener("sidebar-toggled", handleSidebarToggle);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("sidebar-toggled", handleSidebarToggle);
		};
	}, [updateCollapsedState]);

	return (
		<>
			{collapsed && (
				<div className="pointer-events-auto fixed left-4 top-4 z-30 hidden md:block">
					<div className={`flex items-center rounded-xl border bg-card/${opacity.subtle} px-2 py-1.5 shadow-md backdrop-blur ${spacing.gap.xs}`}>
						<SidebarCollapseButton />
					</div>
				</div>
			)}
			<CommandPalette open={open} onOpenChange={setOpen} />
		</>
	);
}
