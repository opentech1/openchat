import * as React from "react";
import { createFileRoute, useParams, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/chat/$id")({
  beforeLoad: async () => {
    try {
      const res = await fetch("/api/auth/get-session", { credentials: "include" });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (!data?.user?.id) throw new Error("no-session");
    } catch {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: ChatRoom,
});

function ChatRoom() {
  const { id } = useParams({ from: "/dashboard/chat/$id" });
  return (
    <main>
      <h2>Chat {id}</h2>
      <p>Chat UI migration pending. This is a placeholder.</p>
    </main>
  );
}
