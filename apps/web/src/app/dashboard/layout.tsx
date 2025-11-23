import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth-guard";
import DashboardLayoutClient from "@/components/dashboard-layout-client";

/**
 * Dashboard Layout
 *
 * Uses client-side authentication via AuthGuard because server-side cookies()
 * doesn't receive browser cookies in some configurations (Cloudflare, Vercel Edge).
 *
 * The AuthGuard checks authentication using fetch() with credentials: 'include'
 * which properly sends HttpOnly cookies.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<AuthGuard>
			<DashboardLayoutClient chats={[]}>
				{children}
			</DashboardLayoutClient>
		</AuthGuard>
	);
}
