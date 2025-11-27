"use client";

import { useState, useEffect } from "react";
import { User, Key, Palette, Zap, LogIn, ChevronRight } from "@/lib/icons";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { ApiKeySectionWithOAuth } from "@/components/settings/api-key-section-with-oauth";
import { JonModeSection } from "@/components/settings/jon-mode-section";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type SettingsTab = "account" | "api" | "appearance" | "preferences";

export default function SettingsPageClient() {
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [isMounted, setIsMounted] = useState(false);
  const { hasKey, isLoading } = useOpenRouterKey();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function handleKeyChanged() {
    // Refresh state after key change
  }

  const displayName = user?.name || user?.email || "User";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "Account", icon: <User className="size-4" /> },
    { id: "api", label: "API", icon: <Key className="size-4" /> },
    { id: "appearance", label: "Theme", icon: <Palette className="size-4" /> },
    { id: "preferences", label: "Preferences", icon: <Zap className="size-4" /> },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              <div className="rounded-xl border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(true)}
                  className="w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <Avatar className="size-14 ring-2 ring-border">
                    {user?.image && (
                      <AvatarImage src={user.image} alt={displayName} />
                    )}
                    <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate">{displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-xs text-primary mt-1">Manage account settings</p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Click to edit your profile, change password, or sign out
              </p>
            </div>
          )}

          {/* API Tab */}
          {activeTab === "api" && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn(
                    "rounded-xl p-3",
                    hasKey ? "bg-emerald-500/10" : "bg-muted"
                  )}>
                    <LogIn className={cn(
                      "size-6",
                      hasKey ? "text-emerald-500" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">OpenRouter</p>
                    <p className="text-sm text-muted-foreground">
                      {hasKey ? "Your account is connected" : "Connect to access AI models"}
                    </p>
                  </div>
                </div>
                
                {!isLoading && !hasKey && (
                  <ApiKeySectionWithOAuth
                    hasStoredKey={hasKey}
                    onKeyChanged={handleKeyChanged}
                  />
                )}
                
                {!isLoading && hasKey && (
                  <div className="flex items-center justify-between pt-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Connected and encrypted
                    </p>
                    <ApiKeySectionWithOAuth
                      hasStoredKey={hasKey}
                      onKeyChanged={handleKeyChanged}
                    />
                  </div>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Your API key is encrypted before storage and synced across devices
              </p>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-5">
                  <p className="font-semibold text-lg">Accent Color</p>
                  <p className="text-sm text-muted-foreground">
                    Personalize your dashboard
                  </p>
                </div>
                {isMounted && <ThemeSelector />}
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-4">
                  <p className="font-semibold text-lg">Output Formatting</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Customize how AI responses appear
                  </p>
                </div>
                <JonModeSection />
              </div>
              
              <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  More preferences coming soon
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AccountSettingsModal 
        open={accountModalOpen} 
        onClose={() => setAccountModalOpen(false)} 
      />
    </div>
  );
}
