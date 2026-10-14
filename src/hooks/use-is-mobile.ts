"use client";

import { useSyncExternalStore } from "react";

/** Matches Tailwind's `md` breakpoint (768px), where the app swaps to its mobile layout. */
const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True below the `md` breakpoint. Renders `false` on the server and during
 * hydration, then updates to the real value on the client.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
