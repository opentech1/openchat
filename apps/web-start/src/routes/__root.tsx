import * as React from "react";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import "@web/index.css";
import { Providers } from "../providers";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <Providers>
      <div style={{ padding: 16 }} className="font-sans">
        <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <Link to="/" activeProps={{ style: { fontWeight: 700 } }}>Home</Link>
          {/* placeholders for future routes */}
          <Link to="/dashboard" activeProps={{ style: { fontWeight: 700 } }}>Dashboard</Link>
          <Link to="/auth/sign-in" activeProps={{ style: { fontWeight: 700 } }}>Sign In</Link>
        </nav>
        <Outlet />
      </div>
    </Providers>
  );
}
