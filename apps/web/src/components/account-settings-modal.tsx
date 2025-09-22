"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@clerk/nextjs";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null) {
	if (!container) return [] as HTMLElement[];
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
	);
}

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return undefined;
		previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const focusable = getFocusableElements(dialogRef.current);
		const target = focusable[0] ?? closeButtonRef.current ?? dialogRef.current;
		requestAnimationFrame(() => {
			target?.focus({ preventScroll: true });
		});
		return () => {
			const previouslyFocused = previouslyFocusedRef.current;
			previouslyFocusedRef.current = null;
			if (previouslyFocused) {
				previouslyFocused.focus({ preventScroll: true });
			}
		};
	}, [open]);

	useEffect(() => {
		if (!open) return undefined;
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const dialog = dialogRef.current;
			if (!dialog) return;
			const focusable = getFocusableElements(dialog);
			if (focusable.length === 0) {
				event.preventDefault();
				return;
			}
			const first = focusable[0]!;
			const last = focusable[focusable.length - 1]!;
			const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			if (event.shiftKey) {
				if (!active || active === first || !dialog.contains(active)) {
					event.preventDefault();
					last.focus();
				}
				return;
			}
			if (!active || active === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", handleKeydown);
		return () => document.removeEventListener("keydown", handleKeydown);
	}, [open, onClose]);

	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
			<div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					className={cn("bg-background w-full max-w-3xl rounded-xl border shadow-2xl")}
					role="dialog"
					aria-modal="true"
					tabIndex={-1}
				>
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h2 className="text-base font-medium">Account Settings</h2>
						<button
							onClick={onClose}
							className="hover:bg-accent rounded-md p-1 text-sm"
							type="button"
							ref={closeButtonRef}
						>
							Close
						</button>
					</div>
					<div className="max-h-[80svh] overflow-auto p-2 sm:p-4">
						{/* Use hash-based routing to avoid catch-all route requirements */}
						<UserProfile routing="hash" />
					</div>
        </div>
      </div>
    </div>
  );
}
