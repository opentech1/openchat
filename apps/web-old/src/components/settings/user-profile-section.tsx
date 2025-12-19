"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { spacing } from "@/styles/design-tokens";

type UserProfileSectionProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

export function UserProfileSection({ user }: UserProfileSectionProps) {
  const displayName = user.name || user.email || "Unnamed user";
  const initials = (() => {
    const parts = displayName.trim().split(/\s+/);
    return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? "").join("") || "U";
  })();

  async function handleCopyUserId() {
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success("User ID copied to clipboard");
    } catch {
      toast.error("Unable to copy user ID");
    }
  }

  return (
    <>
      <div className={`flex items-center ${spacing.gap.md}`}>
        <Avatar className="size-14">
          {user.image ? (
            <AvatarImage src={user.image} alt={displayName || "User"} />
          ) : null}
          <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/50 p-3 text-sm">
        <div className={`flex items-center justify-between ${spacing.gap.sm}`}>
          <div className="max-w-xs truncate text-muted-foreground">User ID: {user.id}</div>
          <Button variant="secondary" size="sm" type="button" onClick={handleCopyUserId} aria-label="Copy user ID to clipboard">
            Copy
          </Button>
        </div>
      </div>
    </>
  );
}
