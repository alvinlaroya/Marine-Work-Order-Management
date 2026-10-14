"use client";

import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Card } from "@/components/ui/card";
import { useSessionContext } from "@/hooks/use-session-context";
import { canManageAdmin } from "@/lib/permissions";

/** Only renders admin screens for an Admin; others get a clear explanation. */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useSessionContext();

  if (!canManageAdmin(profile)) {
    return (
      <Card>
        <EmptyState
          icon={ShieldAlert}
          title="Admin access required"
          description={`${profile?.full_name ?? "This member"} is a ${profile?.role ?? "non-admin"}. Switch to an Admin using the Role and Member dropdowns in the top bar to manage users, vessels and assignments.`}
        />
      </Card>
    );
  }

  return <>{children}</>;
}
