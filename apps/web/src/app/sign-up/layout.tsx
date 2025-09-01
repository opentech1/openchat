import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - OpenChat", 
  description: "Join OpenChat to start chatting",
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}