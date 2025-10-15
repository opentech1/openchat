import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main>
      <h1>OpenChat (TanStack Start)</h1>
      <p>Migration in progress — this is the new app shell.</p>
    </main>
  );
}

