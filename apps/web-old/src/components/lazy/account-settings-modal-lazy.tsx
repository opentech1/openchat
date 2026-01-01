"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const AccountSettingsModal = dynamic(
  () => import("@/components/account-settings-modal").then((mod) => ({ default: mod.AccountSettingsModal })),
  {
    loading: () => null,
    ssr: false,
  }
);

export function AccountSettingsModalLazy(props: ComponentProps<typeof AccountSettingsModal>) {
  return <AccountSettingsModal {...props} />;
}
