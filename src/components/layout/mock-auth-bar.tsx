"use client";

import { useIsFetching, useQuery } from "@tanstack/react-query";
import { Anchor, SlidersHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { RoleBadge } from "@/components/common/role-badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionContext } from "@/hooks/use-session-context";
import { ROLE_OPTIONS } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/validation";
import type { Profile, UserRole } from "@/types/database";

/** Active members of a role, limited to the vessel for Captains and Crew. */
async function fetchMembers(
  role: UserRole,
  vesselId: string | null,
): Promise<Profile[]> {
  const supabase = getSupabaseBrowserClient();
  let profileIds: string[] | null = null;

  if (role !== "Admin" && vesselId) {
    const { data, error } = await supabase
      .from("vessel_assignments")
      .select("profile_id")
      .eq("vessel_id", vesselId)
      .eq("is_active", true);
    if (error) {
      throw error;
    }
    profileIds = (data ?? []).map((row: { profile_id: string }) => row.profile_id);
    if (profileIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("profiles")
    .select("*")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name");
  if (profileIds) {
    query = query.in("id", profileIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data as Profile[];
}

interface StepLabelProps {
  step: number;
  htmlFor: string;
  highlight?: boolean;
  children: React.ReactNode;
}

function StepLabel({ step, htmlFor, highlight = false, children }: StepLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        highlight && "text-primary",
      )}
    >
      <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary">
        {step}
      </span>
      {children}
    </label>
  );
}

export function MockAuthBar() {
  const {
    status,
    profile,
    vessels,
    vessel,
    vesselId,
    hasVesselAccess,
    roleFilter,
    setRoleFilter,
    selectVessel,
    switchMember,
  } = useSessionContext();
  const [panelOpen, setPanelOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [autoOpenMember, setAutoOpenMember] = useState(false);
  const isFetching = useIsFetching() > 0;
  const ready = status === "ready" && profile !== null;

  const membersQuery = useQuery({
    queryKey: queryKeys.profiles(`members-${roleFilter}-${vesselId ?? "none"}`),
    queryFn: () => fetchMembers(roleFilter, vesselId),
    enabled: ready && (roleFilter === "Admin" || vesselId !== null),
  });
  const members = membersQuery.data ?? [];
  const vesselOptions: ComboboxOption[] = vessels.map((item) => ({
    value: item.id,
    label: item.name,
    description: item.imo_number ?? undefined,
  }));
  const memberOptions: ComboboxOption[] = members.map((member) => ({
    value: member.id,
    label: member.full_name,
    description: member.email,
  }));
  const activeInList = members.some((member) => member.id === profile?.id);
  // After a vessel or role change the current member no longer matches the
  // filters, so step 3 is the required next action.
  const needsMember =
    ready &&
    !switching &&
    !membersQuery.isPending &&
    members.length > 0 &&
    !activeInList;

  /** Opens the member list shortly after a vessel/role change (lets the previous menu release focus). */
  function promptMember(): void {
    window.setTimeout(() => setAutoOpenMember(true), 200);
  }

  async function handleMemberChange(memberId: string): Promise<void> {
    const member = members.find((item) => item.id === memberId);
    setSwitching(true);
    try {
      await switchMember(memberId);
      toast.success(`Now viewing as ${member?.full_name ?? "selected member"}`);
    } catch (error) {
      toast.error(parseSupabaseError(error));
    } finally {
      setSwitching(false);
    }
  }

  const memberPlaceholder = membersQuery.isPending
    ? "Loading…"
    : members.length === 0
      ? `No ${roleFilter.toLowerCase()} on this vessel`
      : `Select ${roleFilter.toLowerCase()}…`;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 lg:min-h-16">
          <Link
            href="/dashboard"
            className="order-1 flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Anchor className="size-5" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">Marine Work Orders</span>
              <span className="block text-[11px] text-muted-foreground">
                Reviewer session
              </span>
            </span>
          </Link>

          <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
            {ready ? (
              <div className="flex items-center gap-2.5 rounded-lg border bg-card py-1 pl-1 pr-3 shadow-xs">
                <Avatar name={profile.full_name} className="size-8" />
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="max-w-40 truncate text-sm font-medium">
                    {profile.full_name}
                  </p>
                  <p className="max-w-40 truncate text-[11px] text-muted-foreground">
                    {profile.role}
                    {vessel ? ` · ${vessel.name}` : ""}
                  </p>
                </div>
                <div className="sm:hidden">
                  <RoleBadge role={profile.role} />
                </div>
              </div>
            ) : (
              <Skeleton className="h-10 w-32 rounded-lg" />
            )}
            <ThemeToggle />
            <Button
              variant={panelOpen ? "default" : "outline"}
              size="icon"
              className="md:hidden"
              aria-expanded={panelOpen}
              aria-controls="session-switcher"
              aria-label="Switch vessel, role or member"
              onClick={() => setPanelOpen((open) => !open)}
            >
              <SlidersHorizontal />
            </Button>
          </div>

          <div
            id="session-switcher"
            className={cn(
              "order-3 basis-full pb-2 lg:order-2 lg:basis-0 lg:flex-1 lg:pb-0",
              panelOpen ? "block" : "hidden md:block",
            )}
          >
            <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
              <div>
                <StepLabel step={1} htmlFor="vessel-select">
                  Vessel
                </StepLabel>
                <Combobox
                  id="vessel-select"
                  ariaLabel="Active vessel"
                  floating
                  triggerShowsDescription={false}
                  value={vesselId ?? ""}
                  onValueChange={(value) => {
                    selectVessel(value);
                    promptMember();
                  }}
                  options={vesselOptions}
                  placeholder="No vessels"
                  searchPlaceholder="Search by vessel name or IMO…"
                  emptyText="No vessels match your search."
                  disabled={!ready || switching || vessels.length === 0}
                />
              </div>

              <div>
                <StepLabel step={2} htmlFor="role-select">
                  Role
                </StepLabel>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => {
                    setRoleFilter(value as UserRole);
                    promptMember();
                  }}
                  disabled={!ready || switching}
                >
                  <SelectTrigger id="role-select" aria-label="Filter members by role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <StepLabel step={3} htmlFor="member-select" highlight={needsMember}>
                  Member
                  {needsMember ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-px text-[10px] normal-case tracking-normal text-primary-foreground">
                      Choose one
                    </span>
                  ) : null}
                </StepLabel>
                <Combobox
                  id="member-select"
                  ariaLabel="Switch active member"
                  floating
                  triggerShowsDescription={false}
                  value={activeInList && profile ? profile.id : ""}
                  onValueChange={(value) => void handleMemberChange(value)}
                  options={memberOptions}
                  placeholder={memberPlaceholder}
                  searchPlaceholder={`Search ${roleFilter.toLowerCase()} by name or email…`}
                  emptyText="No members match your search."
                  disabled={!ready || switching || members.length === 0}
                  open={memberOpen || (autoOpenMember && needsMember)}
                  onOpenChange={(next) => {
                    setMemberOpen(next);
                    setAutoOpenMember(false);
                  }}
                  triggerClassName={cn(
                    needsMember &&
                      "border-primary ring-2 ring-primary/40 motion-safe:animate-pulse",
                  )}
                />
              </div>
            </div>

            {ready && profile.role !== "Admin" && !hasVesselAccess && vessel ? (
              <p
                role="status"
                className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
              >
                <TriangleAlert className="size-3.5 shrink-0" />
                {profile.full_name} is not assigned to {vessel.name}, so no work
                orders are visible. Pick a member from this vessel.
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "h-0.5 origin-left bg-primary transition-opacity duration-300",
          isFetching || switching ? "animate-pulse opacity-100" : "opacity-0",
        )}
      />
    </header>
  );
}
