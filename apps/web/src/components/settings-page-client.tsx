"use client";

import { useState } from "react";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { Button } from "@/components/ui/button";

export default function SettingsPageClient() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mt-2">Manage your application preferences and account.</p>

      <div className="mt-6 grid gap-6">
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
          <h2 className="text-sm font-medium">Appearance</h2>
          <p className="text-muted-foreground mt-1 text-sm">Choose the accent color used across the dashboard.</p>
          <ThemeSelector className="mt-4" />
        </section>
      </div>

      <AccountSettingsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
