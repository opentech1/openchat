"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { Button } from "@/components/ui/button";
import { spacing } from "@/styles/design-tokens";

export default function SettingsPageClient() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your application preferences and account.</p>
      </div>

      <div className={`grid ${spacing.gap.xl}`}>
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">Account</h2>
          <p className="text-muted-foreground mt-1 text-sm">Update your profile, emails, and security.</p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => setOpen(true)}>
              Manage account
            </Button>
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
          <p className="text-xs text-muted-foreground mt-2">We&apos;ll keep asking until a key is added.</p>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium">Appearance</h2>
          <p className="text-muted-foreground mt-1 text-sm">Choose the accent color used across the dashboard.</p>
          <ThemeSelector className="mt-4" />
        </section>
      </div>

      <AccountSettingsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
