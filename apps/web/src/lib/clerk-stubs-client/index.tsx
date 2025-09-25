"use client";
import * as React from "react";

function resolveDevUserId() {
	if (typeof window !== "undefined" && (window as any).__DEV_USER_ID__) {
		return (window as any).__DEV_USER_ID__ as string;
	}
	if (process.env.NODE_ENV === "test") {
		return "e2e-user";
	}
	return null;
}

export function SignedIn({ children }: { children: React.ReactNode }) {
	const { isSignedIn } = useAuth();
	return isSignedIn ? <>{children}</> : null;
}
export function SignedOut({ children }: { children: React.ReactNode }) {
	const { isSignedIn } = useAuth();
	return isSignedIn ? null : <>{children}</>;
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
	const userId = resolveDevUserId();
	return { userId, isSignedIn: Boolean(userId) } as any;
}
export const ClerkProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
