import { getUserId } from "@/lib/auth-server";
import SettingsPageClient from "@/components/settings-page-client";
import DashboardAccessFallback from "@/components/dashboard-access-fallback";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const userId = await getUserId();
	if (!userId) {
		return (
			<DashboardAccessFallback
				title="Sign in to manage settings"
				description="Account preferences are only available once you're authenticated."
			/>
		);
	}
	return <SettingsPageClient />;
}
