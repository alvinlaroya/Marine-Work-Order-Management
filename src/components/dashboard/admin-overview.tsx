"use client";

import { Link2, Ship, Users } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAllAssignments,
  useAllProfiles,
  useAllVessels,
} from "@/hooks/use-admin-data";
import { pluralize } from "@/lib/format";

interface AdminTileProps {
  href: string;
  icon: typeof Users;
  title: string;
  value: string | null;
  detail: string;
}

function AdminTile({ href, icon: Icon, title, value, detail }: AdminTileProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-6 w-24" />
        ) : (
          <p className="text-lg font-semibold leading-tight">{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </Link>
  );
}

/** Fleet-wide shortcuts shown to Admins on the overview. */
export function AdminOverview() {
  const profiles = useAllProfiles();
  const vessels = useAllVessels();
  const assignments = useAllAssignments();

  const activeUsers = (profiles.data ?? []).filter((user) => user.is_active);
  const activeVessels = (vessels.data ?? []).filter((vessel) => vessel.is_active);
  const activeAssignments = (assignments.data ?? []).filter((row) => row.is_active);

  const count = (role: string): number =>
    activeUsers.filter((user) => user.role === role).length;

  return (
    <Card className="border-dashed bg-transparent shadow-none">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminTile
          href="/admin/users"
          icon={Users}
          title="Users"
          value={profiles.data ? pluralize(activeUsers.length, "active user") : null}
          detail={`${count("Admin")} admin · ${count("Captain")} captain · ${count("Crew")} crew`}
        />
        <AdminTile
          href="/admin/vessels"
          icon={Ship}
          title="Fleet"
          value={vessels.data ? pluralize(activeVessels.length, "active vessel") : null}
          detail="Create, update or deactivate vessels"
        />
        <AdminTile
          href="/admin/assignments"
          icon={Link2}
          title="Assignments"
          value={
            assignments.data ? pluralize(activeAssignments.length, "assignment") : null
          }
          detail="Who is on which vessel"
        />
      </CardContent>
    </Card>
  );
}
