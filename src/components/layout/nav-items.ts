import {
  ClipboardList,
  LayoutDashboard,
  Link2,
  Ship,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Short label used by the mobile tab bar. */
  shortLabel: string;
  icon: LucideIcon;
}

export const WORKSPACE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", shortLabel: "Overview", icon: LayoutDashboard },
  { href: "/work-orders", label: "Work orders", shortLabel: "Orders", icon: ClipboardList },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/users", label: "Users & roles", shortLabel: "Users", icon: Users },
  { href: "/admin/vessels", label: "Vessels", shortLabel: "Vessels", icon: Ship },
  { href: "/admin/assignments", label: "Assignments", shortLabel: "Crew", icon: Link2 },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
