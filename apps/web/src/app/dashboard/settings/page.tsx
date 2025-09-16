import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-server";
import SettingsPageClient from "@/components/settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/auth/sign-in");
  return <SettingsPageClient />;
}
