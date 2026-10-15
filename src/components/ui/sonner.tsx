"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      // Lift toasts above the on-screen keyboard (see `useKeyboardInset`).
      offset={{ bottom: "calc(16px + var(--keyboard-inset, 0px))", right: 16 }}
      mobileOffset={{
        bottom: "calc(16px + var(--keyboard-inset, 0px))",
        left: 16,
        right: 16,
      }}
    />
  );
}
