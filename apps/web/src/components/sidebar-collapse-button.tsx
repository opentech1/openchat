"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeft, Plus } from "@/lib/icons";
import { useRouter } from "next/navigation";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";

export default function SidebarCollapseButton() {
	const [collapsed, setCollapsed] = useState(false);
	const router = useRouter();

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

		// Listen for storage changes (in case sidebar is toggled from another tab or by custom event)
		const handleStorage = (e: StorageEvent) => {
			if (e.key === LOCAL_STORAGE_KEYS.UI.SIDEBAR_COLLAPSED) {
				updateCollapsedState();
			}
		};

		// Listen for custom sidebar toggle event (dispatched by sidebar component)
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
		// Use metaKey on macOS, ctrlKey on Windows/Linux
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

	const handleNewChat = useCallback(() => {
		router.push("/dashboard");
	}, [router]);

	// Only show button when sidebar is collapsed
	if (!collapsed) return null;

	return (
		<>
			<button
				type="button"
				onClick={toggleSidebar}
				className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
				aria-label="Expand sidebar"
				title="Expand sidebar (Ctrl+B)"
			>
				<PanelLeft className="size-4" />
			</button>
			<button
				type="button"
				onClick={handleNewChat}
				className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
				aria-label="New chat"
				title="New chat"
			>
				<Plus className="size-4" />
			</button>
		</>
	);
}
