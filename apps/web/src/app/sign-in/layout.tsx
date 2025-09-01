import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - OpenChat",
  description: "Sign in to your OpenChat account",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}