"use client";

import { Newspaper } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChangelogButton() {
  return (
    <a
      href="https://updates.osschat.dev/"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-6 right-6 z-50 hidden md:block"
    >
      <Button
        size="icon"
        variant="outline"
        className={cn(
          "size-12 rounded-full shadow-lg",
          "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          "hover:bg-accent hover:scale-105",
          "transition-all duration-150"
        )}
        aria-label="View changelog and updates"
      >
        <Newspaper className="size-5" />
      </Button>
    </a>
  );
}
