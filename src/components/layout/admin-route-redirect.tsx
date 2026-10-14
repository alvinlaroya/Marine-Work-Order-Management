"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSessionContext } from "@/hooks/use-session-context";
import { canManageAdmin } from "@/lib/permissions";
import { isAdminPath, OVERVIEW_PATH } from "@/lib/routes";

/** Sends non-admins away from /admin/* when the active member changes. */
export function AdminRouteRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSessionContext();

  useEffect(() => {
    if (!isAdminPath(pathname)) {
      return;
    }
    if (profile && !canManageAdmin(profile)) {
      router.replace(OVERVIEW_PATH);
    }
  }, [pathname, profile, router]);

  return null;
}
