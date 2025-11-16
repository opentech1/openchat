"use client";

import dynamicImport from "next/dynamic";
import { PageLoader } from "@/components/ui/nice-loader";

// Dynamically import onboarding client component with ssr: false
// This is necessary because OnboardingPage uses useOpenRouterKey hook
// which requires ConvexProvider to be available (client-side only)
const OnboardingClient = dynamicImport(() => import("./onboarding-client"), {
  ssr: false,
  loading: () => <PageLoader message="Loading onboarding..." />,
});

export default function OnboardingPage() {
  return <OnboardingClient />;
}
