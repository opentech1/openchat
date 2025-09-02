"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function ClientToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Toaster 
      position="top-center"
      richColors
      expand={false}
      closeButton
      toastOptions={{
        style: {
          background: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '1px solid hsl(var(--border))',
        },
        className: 'group toast',
        duration: 4000,
      }}
    />
  );
}