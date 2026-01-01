"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeftClose } from "@/lib/icons";
import { opacity } from "@/styles/design-tokens";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";

export default function SidebarControlsWrapper() {
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
		// Initial check
		updateCollapsedState();

		// Listen for storage changes
		const handleStorage = (e: StorageEvent) => {
			if (e.key === LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED) {
				updateCollapsedState();
			}
		};

		// Listen for custom sidebar toggle event
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

	const toggleSidebar = useCallback(() => {
		// Trigger the keyboard shortcut to ensure sidebar component updates
		const isMac = typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac");
		const event = new KeyboardEvent("keydown", {
			key: "b",
			code: "KeyB",
			ctrlKey: !isMac,
			metaKey: isMac,
			bubbles: true,
			cancelable: true,
		});
		window.dispatchEvent(event);
	}, []);

	// Only show when sidebar is NOT collapsed (i.e., expanded)
	if (collapsed) return null;

	return (
		<div className="pointer-events-auto absolute left-4 top-4 z-20 hidden md:block">
			<div className={`flex items-center rounded-xl border bg-card/${opacity.subtle} px-2 py-1.5 shadow-md backdrop-blur`}>
				<button
					type="button"
					onClick={toggleSidebar}
					className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
					aria-label="Collapse sidebar"
					title="Collapse sidebar (Ctrl+B)"
				>
					<PanelLeftClose className="size-4" />
				</button>
			</div>
		</div>
	);
}
