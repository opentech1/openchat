import { getUserContext } from "@/lib/auth-server";
import SettingsPageClient from "@/components/settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const context = await getUserContext();
	return <SettingsPageClient isGuest={context.isGuest} />;
}
