"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type OpenRouterLinkModalProps = {
	open: boolean;
	saving?: boolean;
	errorMessage?: string | null;
	onSubmit: (apiKey: string) => void | Promise<void>;
	onTroubleshoot?: () => void;
};

export function OpenRouterLinkModal({ open, saving, errorMessage, onSubmit, onTroubleshoot }: OpenRouterLinkModalProps) {
	const [apiKey, setApiKey] = useState("");

	useEffect(() => {
		if (!open) setApiKey("");
	}, [open]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md">
			<div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
				<form
					className="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const trimmed = apiKey.trim();
						if (!trimmed || saving) return;
						await onSubmit(trimmed);
					}}
				>
					<div className="flex flex-col gap-2 text-center">
						<h2 className="text-lg font-semibold">Add your OpenRouter API key</h2>
						<p className="text-muted-foreground text-sm">
							Paste a personal API key so OpenChat can stream responses using your OpenRouter account. Keys are encrypted at rest and never leave your server.
						</p>
					</div>
					<div className="flex flex-col gap-2 text-left">
						<Label htmlFor="openrouter-api-key" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							OpenRouter API Key
						</Label>
						<Input
							id="openrouter-api-key"
							value={apiKey}
							onChange={(event) => setApiKey(event.target.value)}
							type="password"
							placeholder="sk-or-v1..."
							autoFocus
							required
							className="font-mono"
						/>
					<p className="text-muted-foreground text-xs">
						You can create a key under <a href="https://openrouter.ai/keys" className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
							OpenRouter → Keys
							<ExternalLink className="h-3 w-3" />
						</a>.
					</p>
					</div>
					{errorMessage ? (
						<div className="bg-destructive/10 text-destructive w-full rounded-lg px-3 py-2 text-xs font-medium text-left">
							{errorMessage}
						</div>
					) : null}
					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							disabled={saving || apiKey.trim().length < 10}
							className={cn("h-9 w-full justify-center text-sm font-semibold")}
						>
							{saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Save and continue"}
						</Button>
						{onTroubleshoot ? (
							<button
								type="button"
								onClick={() => {
									setApiKey("");
									void onTroubleshoot();
								}}
								className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
							>
								Refresh status
							</button>
						) : null}
					</div>
					<p className="text-muted-foreground text-xs text-left">
						Your key never leaves this browser. It is encrypted with an AES key generated via the Web Crypto API and stored locally. Clear browser storage to remove it, or click “Remove key” from settings (coming soon).
					</p>
				</form>
			</div>
		</div>
	);
}
