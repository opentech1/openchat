"use client";

import dynamicImport from "next/dynamic";
import { LoaderIcon } from "lucide-react";

// Dynamically import onboarding client component with ssr: false
// This is necessary because OnboardingPage uses useOpenRouterKey hook
// which requires ConvexProvider to be available (client-side only)
const OnboardingClient = dynamicImport(() => import("./onboarding-client"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-svh items-center justify-center">
      <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function OnboardingPage() {
  return <OnboardingClient />;
}
