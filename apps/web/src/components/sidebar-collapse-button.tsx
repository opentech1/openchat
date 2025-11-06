"use client";

import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";

export default function SidebarCollapseButton() {
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		// Read initial state from localStorage
		const updateCollapsedState = () => {
			try {
				const value = localStorage.getItem("oc:sb:collapsed");
				setCollapsed(value === "1");
			} catch {
				setCollapsed(false);
			}
		};

		// Initial check
		updateCollapsedState();

		// Listen for storage changes (in case sidebar is toggled from another tab)
		const handleStorage = (e: StorageEvent) => {
			if (e.key === "oc:sb:collapsed") {
				updateCollapsedState();
			}
		};

		// Listen for keyboard events to detect Ctrl+B / Cmd+B
		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
				// Small delay to allow localStorage to be updated
				setTimeout(updateCollapsedState, 10);
			}
		};

		window.addEventListener("storage", handleStorage);
		window.addEventListener("keydown", handleKeydown);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("keydown", handleKeydown);
		};
	}, []);

	const toggleSidebar = () => {
		// Trigger the keyboard shortcut to ensure sidebar component updates
		const event = new KeyboardEvent("keydown", {
			key: "b",
			code: "KeyB",
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		window.dispatchEvent(event);
	};

	// Only show button when sidebar is collapsed
	if (!collapsed) return null;

	return (
		<button
			type="button"
			onClick={toggleSidebar}
			className="hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
			aria-label="Expand sidebar"
			title="Expand sidebar (Ctrl+B)"
		>
			<PanelLeft className="size-4" />
		</button>
	);
}
