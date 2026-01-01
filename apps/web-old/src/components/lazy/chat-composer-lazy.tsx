"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { ComposerSkeleton } from "@/components/skeletons/composer-skeleton";

/**
 * Lazy-loaded ChatComposer component.
 *
 * ChatComposer is ~33KB and imports many heavy dependencies:
 * - @radix-ui components (popover, tooltip, dialog)
 * - convex/react hooks
 * - Complex token counting logic
 * - Template parser
 *
 * Dynamic import reduces initial bundle and speeds up dev compilation.
 */
const ChatComposer = dynamic(
  () => import("@/components/chat-composer"),
  {
    loading: () => <ComposerSkeleton />,
    ssr: false,
  }
);

export function ChatComposerLazy(props: ComponentProps<typeof ChatComposer>) {
  return <ChatComposer {...props} />;
}

export default ChatComposerLazy;
