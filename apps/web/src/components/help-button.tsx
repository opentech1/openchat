"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HelpButton() {
  return (
    <a
      href="https://github.com/opentech1/openchat/issues/new"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50"
    >
      <Button
        size="icon"
        variant="outline"
        className={cn(
          "size-12 rounded-full shadow-lg",
          "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          "hover:bg-accent hover:scale-105",
          "transition-all duration-200"
        )}
        aria-label="Report an issue or get help"
      >
        <HelpCircle className="size-5" />
      </Button>
    </a>
  );
}
