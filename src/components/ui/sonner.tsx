"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      offset={{ bottom: 16, right: 16 }}
      mobileOffset={{ bottom: 16, left: 16, right: 16 }}
    />
  );
}
