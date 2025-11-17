"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@/lib/icons";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { ApiKeySectionWithOAuth } from "@/components/settings/api-key-section-with-oauth";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { Button } from "@/components/ui/button";
import { spacing } from "@/styles/design-tokens";

export default function SettingsPageClient() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { hasKey, isLoading } = useOpenRouterKey();
  const [keyChangeCounter, setKeyChangeCounter] = useState(0);

  function handleKeyChanged() {
    setKeyChangeCounter((prev) => prev + 1);
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6 overflow-y-auto h-full min-h-0">
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

        <section className="rounded-xl border p-4 space-y-3">
          <div>
            <h2 className="text-sm font-medium">OpenRouter Connection</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Connect your OpenRouter account via OAuth to access AI models.
            </p>
          </div>
          {!isLoading && (
            <ApiKeySectionWithOAuth
              hasStoredKey={hasKey}
              onKeyChanged={handleKeyChanged}
            />
          )}
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
