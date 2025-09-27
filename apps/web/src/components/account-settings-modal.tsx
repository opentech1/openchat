"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@openchat/auth/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { loadOpenRouterKey, removeOpenRouterKey, saveOpenRouterKey } from "@/lib/openrouter-key-storage";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null) {
	if (!container) return [] as HTMLElement[];
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
	);
}

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const dialogRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);
	const [signingOut, setSigningOut] = useState(false);
	const [apiKeyInput, setApiKeyInput] = useState("");
	const [savingKey, setSavingKey] = useState(false);
	const [removingKey, setRemovingKey] = useState(false);
	const [apiKeyError, setApiKeyError] = useState<string | null>(null);
	const [hasStoredKey, setHasStoredKey] = useState(false);
	const [storedKeyTail, setStoredKeyTail] = useState<string | null>(null);

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

	useEffect(() => {
		if (!open) {
			setApiKeyInput("");
			setApiKeyError(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const existing = await loadOpenRouterKey();
				if (cancelled) return;
				if (existing) {
					setHasStoredKey(true);
					setStoredKeyTail(existing.slice(-4));
				} else {
					setHasStoredKey(false);
					setStoredKeyTail(null);
				}
				setApiKeyError(null);
			} catch (error) {
				console.error("load-openrouter-key", error);
				if (cancelled) return;
				setHasStoredKey(false);
				setStoredKeyTail(null);
				setApiKeyError("Unable to load your saved OpenRouter key.");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open]);

	const user = session?.user;
	if (!open || !user) return null;

	const initials = (() => {
		const label = user.name || user.email || "";
		if (!label) return "U";
		const parts = label.trim().split(/\s+/);
		return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
	})();

	async function handleSaveApiKey(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (savingKey) return;
		const trimmed = apiKeyInput.trim();
		if (trimmed.length < 10) {
			setApiKeyError("Enter a valid OpenRouter key (sk-or-v1…).");
			return;
		}
		setSavingKey(true);
		setApiKeyError(null);
		try {
			await saveOpenRouterKey(trimmed);
			setHasStoredKey(true);
			setStoredKeyTail(trimmed.slice(-4));
			setApiKeyInput("");
			toast.success("OpenRouter key saved");
		} catch (error) {
			console.error("save-openrouter-key", error);
			setApiKeyError("Failed to save OpenRouter key.");
			toast.error("Failed to save OpenRouter key");
		} finally {
			setSavingKey(false);
		}
	}

	async function handleRemoveApiKey() {
		if (removingKey) return;
		setRemovingKey(true);
		try {
			removeOpenRouterKey();
			setHasStoredKey(false);
			setStoredKeyTail(null);
			setApiKeyInput("");
			setApiKeyError(null);
			toast.success("OpenRouter key removed");
		} catch (error) {
			console.error("remove-openrouter-key", error);
			toast.error("Failed to remove OpenRouter key");
		} finally {
			setRemovingKey(false);
		}
	}

	async function handleSignOut() {
		try {
			setSigningOut(true);
			const { error } = await authClient.signOut();
			if (error) {
				toast.error(error.message ?? "Unable to sign out");
				return;
			}
			onClose();
			toast.success("Signed out");
			router.push("/");
			router.refresh();
		} catch (error) {
			console.error("sign-out", error);
			toast.error("Unexpected error while signing out");
		} finally {
			setSigningOut(false);
		}
	}

	async function handleCopyUserId() {
		try {
			await navigator.clipboard.writeText(user.id);
			toast.success("User ID copied to clipboard");
		} catch {
			toast.error("Unable to copy user ID");
		}
	}

	const modal = (
		<div className="fixed inset-0 z-50">
			<div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
			<div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
				<div
					ref={dialogRef}
					className={cn("bg-background w-full max-w-lg rounded-xl border shadow-2xl")}
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
					<div className="max-h-[80svh] overflow-auto p-4 space-y-6">
						<div className="flex items-center gap-3">
							<Avatar className="size-14">
								{user.image ? <AvatarImage src={user.image} alt={user.name ?? user.email ?? "User"} /> : null}
								<AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
							</Avatar>
							<div>
								<p className="text-sm font-medium">{user.name || "Unnamed user"}</p>
								<p className="text-muted-foreground text-sm">{user.email}</p>
							</div>
						</div>
						<div className="rounded-lg border bg-muted/50 p-3 text-sm">
							<div className="flex items-center justify-between gap-2">
								<div className="max-w-xs truncate text-muted-foreground">User ID: {user.id}</div>
								<Button variant="secondary" size="sm" type="button" onClick={handleCopyUserId}>
									Copy
								</Button>
							</div>
						</div>
						<div className="rounded-lg border bg-muted/40 p-4 space-y-3">
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-medium">OpenRouter API key</p>
									<p className="text-xs text-muted-foreground">Connect your personal key so OpenChat can call OpenRouter models for you.</p>
								</div>
								<span className={cn("text-xs font-medium", hasStoredKey ? "text-emerald-600" : "text-destructive")}>
									{hasStoredKey ? `Linked${storedKeyTail ? ` ••••${storedKeyTail}` : ""}` : "Not linked"}
								</span>
							</div>
							{apiKeyError ? <p className="text-xs font-medium text-destructive">{apiKeyError}</p> : null}
							<form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSaveApiKey}>
								<Input
									value={apiKeyInput}
									onChange={(event) => {
										setApiKeyInput(event.target.value);
										if (apiKeyError) setApiKeyError(null);
									}}
									type="password"
									placeholder="sk-or-v1..."
									autoComplete="off"
									required
									className="font-mono"
								/>
								<Button type="submit" disabled={savingKey || apiKeyInput.trim().length < 10} className="sm:w-auto">
									{savingKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									{hasStoredKey ? "Replace key" : "Save key"}
								</Button>
							</form>
							<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
								<p>Keys are encrypted locally in your browser. Remove the key to stop using OpenRouter.</p>
								{hasStoredKey ? (
									<Button type="button" variant="ghost" size="sm" onClick={handleRemoveApiKey} disabled={removingKey}>
										{removingKey ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
										Remove key
									</Button>
								) : null}
							</div>
						</div>


					<div className="space-y-2 text-sm text-muted-foreground">
							<p>You are signed in with Better Auth. Use the button below to sign out from all tabs.</p>
						</div>
						<Button variant="destructive" className="w-full" onClick={handleSignOut} disabled={signingOut}>
							{signingOut ? "Signing out…" : "Sign out"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);

	const portalTarget = typeof document !== "undefined" ? document.body : null;
	if (!portalTarget) return null;
	return createPortal(modal, portalTarget);
}
