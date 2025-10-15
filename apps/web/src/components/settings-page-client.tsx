"use client";

import { useState } from "react";
import Link from "next/link";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SettingsPageClientProps = {
	isGuest?: boolean;
};

export default function SettingsPageClient({ isGuest }: SettingsPageClientProps) {
  const [open, setOpen] = useState(false);
  const accountDisabled = Boolean(isGuest);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your application preferences and account.</p>
      </div>

      {accountDisabled ? (
        <div className="border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-200">
          You&apos;re exploring OpenChat in guest mode. Saved account settings and team sharing require signing in, but you can still
          store an OpenRouter API key in your browser for testing.
        </div>
      ) : null}

      <div className="grid gap-6">
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">Account</h2>
          <p className="text-muted-foreground mt-1 text-sm">Update your profile, emails, and security.</p>
          <div className="mt-3">
            {accountDisabled ? (
              <Button variant="outline" asChild>
                <Link href="/auth/sign-in">Sign in to manage your account</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(true)}>
                Manage account
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">OpenRouter API</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Generate an API key at
            {" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              openrouter.ai/keys
            </a>
            {" "}
            and save it when prompted in the chat composer. Keys are stored locally in your browser.
          </p>
          <p className={cn("text-xs text-muted-foreground mt-2", accountDisabled && "italic")}>We&apos;ll keep asking until a key is added.</p>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">Appearance</h2>
          <p className="text-muted-foreground mt-1 text-sm">Choose the accent color used across the dashboard.</p>
          <ThemeSelector className="mt-4" />
        </section>
      </div>

      <AccountSettingsModal open={open && !accountDisabled} onClose={() => setOpen(false)} />
    </div>
  );
}
