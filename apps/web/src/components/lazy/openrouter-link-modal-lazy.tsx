"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const OpenRouterLinkModal = dynamic(
  () => import("@/components/openrouter-link-modal").then((mod) => ({ default: mod.OpenRouterLinkModal })),
  {
    loading: () => null,
    ssr: false,
  }
);

export function OpenRouterLinkModalLazy(props: ComponentProps<typeof OpenRouterLinkModal>) {
  return <OpenRouterLinkModal {...props} />;
}
