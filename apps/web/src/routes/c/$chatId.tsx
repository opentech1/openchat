/**
 * Chat Page - Individual chat conversation
 *
 * Route: /c/$chatId
 * Loads chat history and allows continuing the conversation.
 * Uses OSSChat Cloud (free tier) by default, no API key required.
 */
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-client";
import { ChatInterface } from "@/components/chat-interface";
import { Button } from "@/components/ui/button";
import { convexClient } from "@/lib/convex";

export const Route = createFileRoute("/c/$chatId")({
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const { isAuthenticated, loading } = useAuth();

  if (!convexClient || loading) {
    return <div className="flex h-full bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="text-muted-foreground">You need to be signed in to access this chat.</p>
        <Link to="/auth/sign-in">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }
  useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.repeat) return;

    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const isShortcut =
      (isMac && e.metaKey && e.key.toLowerCase() === "l") ||
      (!isMac && e.ctrlKey && e.key.toLowerCase() === "l");

    if (!isShortcut) return;

    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable)
    ) {
      return;
    }

    e.preventDefault();

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement | null;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, []);

  return <ChatInterface chatId={chatId} />;
}
