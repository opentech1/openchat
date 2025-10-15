import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

function SignIn() {
  return (
    <main>
      <h2>Sign In</h2>
      <p>Auth UI migration pending. Use the Next.js app for now.</p>
      <p>
        Don’t have an account? <Link to="/auth/sign-up">Sign up</Link>
      </p>
    </main>
  );
}

