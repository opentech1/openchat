import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import SettingsPageClient from "@/components/settings-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/auth/sign-in");
  return <SettingsPageClient />;
}

