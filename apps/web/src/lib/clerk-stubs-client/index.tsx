"use client";
import * as React from "react";

export function SignedIn({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
export function SignedOut({ children: _children }: { children: React.ReactNode }) {
	return null;
}
export function SignIn() {
	return null as any;
}
export function SignUp() {
	return null as any;
}
export function UserButton() {
	return null as any;
}
export function UserProfile(_props: any) {
	return null as any;
}
export function useAuth() {
	const userId = (typeof window !== "undefined" && (window as any).__DEV_USER_ID__) || "e2e-user";
	return { userId, isSignedIn: !!userId } as any;
}
export const ClerkProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
