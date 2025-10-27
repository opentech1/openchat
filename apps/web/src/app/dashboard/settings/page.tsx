import { getUserContext } from "@/lib/auth-server";
import SettingsPageClient from "@/components/settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	await getUserContext();
	return <SettingsPageClient />;
}
