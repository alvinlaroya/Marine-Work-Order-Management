"use client";

import { useSessionContext } from "@/hooks/use-session-context";
import { canManageAdmin } from "@/lib/permissions";

/** Only renders admin screens for an Admin; redirect handled by AdminRouteRedirect. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useSessionContext();

  if (!canManageAdmin(profile)) {
    return null;
  }

  return <>{children}</>;
}
