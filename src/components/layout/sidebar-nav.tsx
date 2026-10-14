"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { RoleBadge } from "@/components/common/role-badge";
import {
  ADMIN_NAV,
  WORKSPACE_NAV,
  isActivePath,
  type NavItem,
} from "@/components/layout/nav-items";
import { useSessionContext } from "@/hooks/use-session-context";
import { canManageAdmin, ROLE_SUMMARY } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SidebarNav() {
  const { profile } = useSessionContext();

  return (
    <nav aria-label="Primary" className="space-y-6">
      <NavGroup title="Workspace" items={WORKSPACE_NAV} />
      {canManageAdmin(profile) ? (
        <NavGroup title="Administration" items={ADMIN_NAV} />
      ) : null}

      {profile ? (
        <div className="space-y-2 rounded-xl border bg-card p-3 text-sm shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Signed in as</span>
            <RoleBadge role={profile.role} />
          </div>
          <p className="font-medium leading-tight">{profile.full_name}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {ROLE_SUMMARY[profile.role]}
          </p>
        </div>
      ) : null}
    </nav>
  );
}
