"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Anchor,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Ship,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AdminGuard } from "@/components/admin/admin-guard";
import { VesselFormDialog } from "@/components/admin/vessel-form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAllAssignments,
  useAllVessels,
  useInvalidateAdminData,
} from "@/hooks/use-admin-data";
import { isActiveAssignment } from "@/lib/assignments";
import { adminUpsertVessel } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/validation";
import type { Vessel } from "@/types/database";

type StatusTab = "all" | "active" | "inactive";
type StaffingFilter = "all" | "no-captain" | "no-crew" | "unassigned";

interface Staffing {
  Captain: number;
  Crew: number;
}

const STAFFING_OPTIONS: { value: StaffingFilter; label: string }[] = [
  { value: "all", label: "Any staffing" },
  { value: "no-captain", label: "No Captain assigned" },
  { value: "no-crew", label: "No Crew assigned" },
  { value: "unassigned", label: "No Captain or Crew" },
];

// 12 divides evenly into the 1, 2 and 3 column card grids, so pages never end ragged.
const PAGE_SIZE = 12;

function VesselsContent() {
  const vesselsQuery = useAllVessels();
  const assignmentsQuery = useAllAssignments();
  const invalidate = useInvalidateAdminData();
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [staffingFilter, setStaffingFilter] = useState<StaffingFilter>("all");
  const [page, setPage] = useState(1);
  const [formVessel, setFormVessel] = useState<Vessel | null | "new">(null);
  const [toDeactivate, setToDeactivate] = useState<Vessel | null>(null);

  const vessels = vesselsQuery.data ?? [];
  const assignments = (assignmentsQuery.data ?? []).filter(isActiveAssignment);

  const staffing = new Map<string, Staffing>();
  for (const row of assignments) {
    const entry = staffing.get(row.vessel_id) ?? { Captain: 0, Crew: 0 };
    if (row.profile?.role === "Captain" || row.profile?.role === "Crew") {
      entry[row.profile.role] += 1;
    }
    staffing.set(row.vessel_id, entry);
  }

  const crewCount = (vesselId: string, role: "Captain" | "Crew"): number =>
    staffing.get(vesselId)?.[role] ?? 0;

  const matchesStaffing = (vesselId: string): boolean => {
    const captains = crewCount(vesselId, "Captain");
    const crew = crewCount(vesselId, "Crew");
    switch (staffingFilter) {
      case "no-captain":
        return captains === 0;
      case "no-crew":
        return crew === 0;
      case "unassigned":
        return captains === 0 && crew === 0;
      default:
        return true;
    }
  };

  const setActive = useMutation({
    mutationFn: async ({ vessel, active }: { vessel: Vessel; active: boolean }) => {
      const { error } = await adminUpsertVessel({
        p_id: vessel.id,
        p_name: vessel.name,
        p_imo_number: vessel.imo_number,
        p_is_active: active,
      });
      if (error) {
        throw error;
      }
      return { vessel, active };
    },
    onSuccess: async ({ vessel, active }) => {
      toast.success(`${vessel.name} ${active ? "reactivated" : "deactivated"}`);
      setToDeactivate(null);
      await invalidate();
    },
    onError: (error) => {
      setToDeactivate(null);
      toast.error(parseSupabaseError(error));
    },
  });

  const needle = search.trim().toLowerCase();
  const visible = vessels.filter(
    (vessel) =>
      (tab === "all" || (tab === "active" ? vessel.is_active : !vessel.is_active)) &&
      (needle === "" ||
        vessel.name.toLowerCase().includes(needle) ||
        (vessel.imo_number ?? "").toLowerCase().includes(needle)) &&
      matchesStaffing(vessel.id),
  );
  // The staffing filter needs assignment data, so wait for it rather than flash
  // every vessel as "unstaffed".
  const listPending =
    vesselsQuery.isPending || (staffingFilter !== "all" && assignmentsQuery.isPending);
  const filtersActive = needle !== "" || staffingFilter !== "all";
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp so the page stays valid if the list shrinks (e.g. after a refetch).
  const currentPage = Math.min(page, totalPages);
  const pageVessels = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const countFor = (value: StatusTab): number =>
    vessels.filter(
      (vessel) =>
        value === "all" || (value === "active" ? vessel.is_active : !vessel.is_active),
    ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Vessels"
        description="Create, update and deactivate the vessels in your fleet. Deactivated vessels disappear from the vessel selector."
        actions={
          <Button onClick={() => setFormVessel("new")}>
            <Plus />
            Add vessel
          </Button>
        }
      />

      {vesselsQuery.isError ? (
        <QueryError
          error={vesselsQuery.error}
          title="Could not load vessels"
          onRetry={() => void vesselsQuery.refetch()}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Tabs
                value={tab}
                onValueChange={(value) => {
                  setTab(value as StatusTab);
                  setPage(1);
                }}
              >
                <TabsList>
                  {(["all", "active", "inactive"] as StatusTab[]).map((value) => (
                    <TabsTrigger key={value} value={value} className="capitalize">
                      {value}
                      <span
                        className={cn(
                          "rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums",
                          tab === value && "bg-primary/10 text-primary",
                        )}
                      >
                        {vesselsQuery.isPending ? "–" : countFor(value)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name or IMO number"
                aria-label="Search vessels"
                className="sm:w-64"
              />
              <Select
                value={staffingFilter}
                onValueChange={(value) => {
                  setStaffingFilter(value as StaffingFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Filter vessels by staffing" className="sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFFING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {listPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={Ship}
                title={
                  vessels.length === 0
                    ? "No vessels yet"
                    : filtersActive
                      ? "No matching vessels"
                      : `No ${tab} vessels`
                }
                description={
                  vessels.length === 0
                    ? "Add your first vessel to start assigning crew and work orders."
                    : filtersActive
                      ? "Try another status tab, change the staffing filter or clear the search."
                      : "Switch tabs to see the rest of the fleet."
                }
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pageVessels.map((vessel) => (
                  <Card
                    key={vessel.id}
                    className={cn("flex flex-col p-5", !vessel.is_active && "opacity-70")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Ship className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{vessel.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {vessel.imo_number ?? "No IMO number"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${vessel.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setFormVessel(vessel)}>
                            <Pencil />
                            Edit vessel
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {vessel.is_active ? (
                            <DropdownMenuItem
                              destructive
                              onSelect={() => setToDeactivate(vessel)}
                            >
                              <PowerOff />
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => setActive.mutate({ vessel, active: true })}
                            >
                              <Power />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Anchor className="size-4 text-muted-foreground" />
                        <span>
                          <span className="font-semibold tabular-nums">
                            {crewCount(vessel.id, "Captain")}
                          </span>{" "}
                          <span className="text-muted-foreground">Captains</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wrench className="size-4 text-muted-foreground" />
                        <span>
                          <span className="font-semibold tabular-nums">
                            {crewCount(vessel.id, "Crew")}
                          </span>{" "}
                          <span className="text-muted-foreground">Crew</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      {vessel.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="muted">Inactive</Badge>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/assignments?vessel=${vessel.id}`}>
                          <Users />
                          Manage crew
                        </Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={visible.length}
                onPageChange={setPage}
                itemLabel="vessel"
              />
            </>
          )}
        </>
      )}

      {formVessel !== null ? (
        <VesselFormDialog
          key={formVessel === "new" ? "new" : formVessel.id}
          vessel={formVessel === "new" ? null : formVessel}
          onClose={() => setFormVessel(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => (!open ? setToDeactivate(null) : undefined)}
        title={`Deactivate ${toDeactivate?.name ?? "vessel"}?`}
        description="It will no longer appear in the vessel selector. Existing records are kept and you can reactivate it at any time."
        confirmLabel="Deactivate vessel"
        destructive
        pending={setActive.isPending}
        onConfirm={() =>
          toDeactivate && setActive.mutate({ vessel: toDeactivate, active: false })
        }
      />
    </div>
  );
}

export default function AdminVesselsPage() {
  return (
    <AdminGuard>
      <VesselsContent />
    </AdminGuard>
  );
}
