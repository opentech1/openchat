"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserProfile } from "@clerk/nextjs";

export function AccountSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
        <div className={cn("bg-background w-full max-w-3xl rounded-xl border shadow-2xl")}
             role="dialog" aria-modal="true">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-medium">Account Settings</h2>
            <button onClick={onClose} className="hover:bg-accent rounded-md p-1 text-sm">Close</button>
          </div>
          <div className="max-h-[80svh] overflow-auto p-2 sm:p-4">
            {/* Use hash-based routing to avoid catch-all route requirements */}
            <UserProfile routing="hash" />
          </div>
        </div>
      </div>
    </div>
  );
}

