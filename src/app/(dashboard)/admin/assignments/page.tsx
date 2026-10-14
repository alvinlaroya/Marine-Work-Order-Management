"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  MoreHorizontal,
  Plus,
  Ship,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import {
  AssignMemberDialog,
  MoveMemberDialog,
  type AssignRole,
} from "@/components/admin/assignment-dialogs";
import { AdminGuard } from "@/components/admin/admin-guard";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RoleBadge } from "@/components/common/role-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAllAssignments,
  useAllProfiles,
  useAllVessels,
  useInvalidateAdminData,
} from "@/hooks/use-admin-data";
import { useSessionContext } from "@/hooks/use-session-context";
import {
  assignableProfiles,
  isActiveAssignment,
  unassignedProfiles,
} from "@/lib/assignments";
import { pluralize } from "@/lib/format";
import { adminRemoveAssignment } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/validation";
import type { AssignmentRow, Profile } from "@/types/database";

/**
 * Long member lists scroll inside their card instead of stretching the page.
 * The cap is the smaller of 36rem and 60% of the viewport height, so it fits
 * short screens too. Focusable so keyboard users can scroll it.
 */
const SCROLL_LIST_CLASS =
  "max-h-[min(36rem,60dvh)] divide-y overflow-y-auto overscroll-contain rounded-md pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type DialogState =
  | { kind: "assign"; profileId?: string; role?: AssignRole }
  | { kind: "move"; assignment: AssignmentRow }
  | null;

function AssignmentsContent() {
  const { vesselId: globalVesselId } = useSessionContext();
  const vesselsQuery = useAllVessels();
  const profilesQuery = useAllProfiles();
  const assignmentsQuery = useAllAssignments();
  const invalidate = useInvalidateAdminData();
  const searchParams = useSearchParams();
  // `?vessel=<id>` comes from "Manage crew" on the Vessels page.
  const linkedVesselId = searchParams.get("vessel");
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toRemove, setToRemove] = useState<AssignmentRow | null>(null);
  // Below `lg` only one roster is shown at a time; from `lg` up both sit side by side.
  const [rosterTab, setRosterTab] = useState<AssignRole>("Captain");
  const [captainSearch, setCaptainSearch] = useState("");
  const [crewSearch, setCrewSearch] = useState("");

  const activeVessels = (vesselsQuery.data ?? []).filter((vessel) => vessel.is_active);
  const vesselOptions: ComboboxOption[] = activeVessels.map((item) => ({
    value: item.id,
    label: item.name,
    description: item.imo_number ? `IMO ${item.imo_number}` : undefined,
  }));
  const vessel =
    activeVessels.find(
      (item) => item.id === (selectedVesselId ?? linkedVesselId ?? globalVesselId),
    ) ??
    activeVessels[0] ??
    null;

  const profiles = profilesQuery.data ?? [];
  const allRows = assignmentsQuery.data ?? [];
  const roster = vessel
    ? allRows.filter((row) => row.vessel_id === vessel.id && isActiveAssignment(row))
    : [];
  const captains = roster.filter((row) => row.profile?.role === "Captain");
  const crew = roster.filter((row) => row.profile?.role === "Crew");
  const unassigned = unassignedProfiles(profiles, allRows);

  const remove = useMutation({
    mutationFn: async (assignment: AssignmentRow) => {
      const { error } = await adminRemoveAssignment(assignment.id);
      if (error) {
        throw error;
      }
      return assignment;
    },
    onSuccess: async (assignment) => {
      toast.success(
        `${assignment.profile?.full_name ?? "Member"} removed from ${assignment.vessel?.name ?? "vessel"}`,
      );
      setToRemove(null);
      await invalidate();
    },
    onError: (error) => {
      setToRemove(null);
      toast.error("Could not remove assignment", {
        description: parseSupabaseError(error),
        duration: 8000,
      });
    },
  });

  const isLoading =
    vesselsQuery.isPending || profilesQuery.isPending || assignmentsQuery.isPending;
  const loadError = vesselsQuery.error ?? profilesQuery.error ?? assignmentsQuery.error;

  function renderMember(row: AssignmentRow) {
    const member = row.profile;
    if (!member) {
      return null;
    }
    return (
      <li key={row.id} className="flex items-center gap-3 py-3">
        <Avatar name={member.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{member.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
        <div className="hidden sm:block">
          <RoleBadge role={member.role} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${member.full_name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setDialog({ kind: "move", assignment: row })}>
              <ArrowRightLeft />
              Move to another vessel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setToRemove(row)}>
              <UserMinus />
              Remove from vessel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  function renderRoster(
    title: string,
    role: AssignRole,
    allRoleRows: AssignmentRow[],
    emptyText: string,
    search: string,
    onSearchChange: (value: string) => void,
  ) {
    const hiddenBelowLg = rosterTab !== role;
    const needle = search.trim().toLowerCase();
    const rows = needle
      ? allRoleRows.filter(
          (row) =>
            row.profile?.full_name.toLowerCase().includes(needle) ||
            row.profile?.email.toLowerCase().includes(needle),
        )
      : allRoleRows;

    return (
      <Card className={cn(hiddenBelowLg && "hidden lg:block")}>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            {title}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {needle ? `${rows.length} of ${allRoleRows.length}` : allRoleRows.length}
            </span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog({ kind: "assign", role })}
          >
            <Plus />
            Add {role.toLowerCase()}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {allRoleRows.length > 0 ? (
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={`Search ${title.toLowerCase()} by name or email`}
              aria-label={`Search ${title.toLowerCase()}`}
            />
          ) : null}
          {allRoleRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No {title.toLowerCase()} match &ldquo;{search.trim()}&rdquo;.
            </p>
          ) : (
            <ul
              tabIndex={0}
              aria-label={`${title} list`}
              className={SCROLL_LIST_CLASS}
            >
              {rows.map((row) => renderMember(row))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Vessel assignments"
        description="Assign Captains and Crew to vessels, move them between vessels, or remove them. Removal is blocked while they own active work orders."
        actions={
          vessel ? (
            <Button onClick={() => setDialog({ kind: "assign" })}>
              <Plus />
              Assign member
            </Button>
          ) : null
        }
      />

      {loadError ? (
        <QueryError
          error={loadError}
          title="Could not load assignments"
          onRetry={() => {
            void vesselsQuery.refetch();
            void profilesQuery.refetch();
            void assignmentsQuery.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : !vessel ? (
        <Card>
          <EmptyState
            icon={Ship}
            title="No active vessels"
            description="Create a vessel first, then assign Captains and Crew to it."
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <Label htmlFor="assignment-vessel">Vessel</Label>
            <Combobox
              id="assignment-vessel"
              floating
              value={vessel.id}
              onValueChange={(value) => {
                setSelectedVesselId(value);
                setCaptainSearch("");
                setCrewSearch("");
              }}
              options={vesselOptions}
              placeholder="Select vessel"
              searchPlaceholder="Search vessels by name or IMO…"
              emptyText="No vessels match your search."
              sheetTitle="Select vessel"
            />
            <p className="text-xs text-muted-foreground">
              {pluralize(captains.length, "Captain")} and {pluralize(crew.length, "crew member")}{" "}
              on {vessel.name}.
            </p>
          </div>

          <Tabs
            value={rosterTab}
            onValueChange={(value) => setRosterTab(value as AssignRole)}
            className="lg:hidden"
          >
            <TabsList className="grid w-full grid-cols-2">
              {(
                [
                  ["Captain", "Captains", captains.length],
                  ["Crew", "Crew", crew.length],
                ] as const
              ).map(([value, label, count]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                  <span
                    className={cn(
                      "rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums",
                      rosterTab === value && "bg-primary/10 text-primary",
                    )}
                  >
                    {count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-6 lg:grid-cols-2">
            {renderRoster(
              "Captains",
              "Captain",
              captains,
              "No Captain assigned. Work orders cannot be created for this vessel.",
              captainSearch,
              setCaptainSearch,
            )}
            {renderRoster(
              "Crew",
              "Crew",
              crew,
              "No crew assigned yet.",
              crewSearch,
              setCrewSearch,
            )}
          </div>

          {unassigned.length > 0 ? (
            <Card className="border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersRound className="size-4" />
                  Not assigned to any vessel
                </CardTitle>
                <CardDescription>
                  These active members cannot access any work orders until they are
                  assigned.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul
                  tabIndex={0}
                  aria-label="Members not assigned to any vessel"
                  className={SCROLL_LIST_CLASS}
                >
                  {unassigned.map((member: Profile) => (
                    <li key={member.id} className="flex items-center gap-3 py-3">
                      <Avatar name={member.full_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{member.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <RoleBadge role={member.role} />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialog({ kind: "assign", profileId: member.id })}
                      >
                        <UserPlus />
                        Assign
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {dialog?.kind === "assign" && vessel ? (
        <AssignMemberDialog
          key={`${dialog.profileId ?? "assign"}-${dialog.role ?? "any"}`}
          vessel={vessel}
          candidates={assignableProfiles(profiles, allRows, vessel.id)}
          rows={allRows}
          initialProfileId={dialog.profileId}
          initialRole={dialog.role}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === "move" ? (
        <MoveMemberDialog
          key={dialog.assignment.id}
          assignment={dialog.assignment}
          vessels={activeVessels}
          rows={allRows}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => (!open ? setToRemove(null) : undefined)}
        title={`Remove ${toRemove?.profile?.full_name ?? "member"} from ${toRemove?.vessel?.name ?? "vessel"}?`}
        description="They will immediately lose access to this vessel's work orders. You can assign them again later."
        confirmLabel="Remove from vessel"
        destructive
        pending={remove.isPending}
        onConfirm={() => toRemove && remove.mutate(toRemove)}
      />
    </div>
  );
}

export default function AdminAssignmentsPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <AssignmentsContent />
      </Suspense>
    </AdminGuard>
  );
}
