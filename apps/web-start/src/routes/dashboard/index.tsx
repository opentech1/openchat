import * as React from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    // Simple server/client guard: require session
    try {
      const res = await fetch("/api/auth/get-session", { credentials: "include" });
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (!data?.user?.id) throw new Error("no-session");
    } catch {
      throw redirect({ to: "/auth/sign-in" });
    }
  },
  component: Dashboard,
});

function Dashboard() {
  return (
    <main>
      <h2>Dashboard</h2>
      <p>This is a placeholder dashboard in the TanStack app.</p>
      <ul>
        <li>
          <Link to="/dashboard/chat/$id" params={{ id: "example" }}>Open chat example</Link>
        </li>
      </ul>
    </main>
  );
}
