import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
});

function SignUp() {
  return (
    <main>
      <h2>Sign Up</h2>
      <p>Auth UI migration pending. Use the Next.js app for now.</p>
      <p>
        Already have an account? <Link to="/auth/sign-in">Sign in</Link>
      </p>
    </main>
  );
}

