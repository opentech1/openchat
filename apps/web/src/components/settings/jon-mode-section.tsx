"use client";

import { useJonMode } from "@/hooks/use-jon-mode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function JonModeSection() {
  const { jonMode, setJonMode, isLoading } = useJonMode();

  if (isLoading) {
    return <div className="h-10 animate-pulse bg-muted rounded" />;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="jon-mode" className="text-sm font-medium">
          Jon Mode
        </Label>
        <p className="text-sm text-muted-foreground">
          Fully removes em-dashes (—) from all AI responses. The model will never be able to use them.
        </p>
      </div>
      <Switch
        id="jon-mode"
        checked={jonMode}
        onCheckedChange={setJonMode}
      />
    </div>
  );
}
