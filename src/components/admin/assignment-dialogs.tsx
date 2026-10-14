"use client";

import { useMutation } from "@tanstack/react-query";
import { Anchor, Loader2, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInvalidateAdminData } from "@/hooks/use-admin-data";
import { findAssignment, resolveAssignmentId } from "@/lib/assignments";
import { adminRemoveAssignment, adminUpsertAssignment } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/validation";
import type { AssignmentRow, Profile, UserRole, Vessel } from "@/types/database";

export type AssignRole = Exclude<UserRole, "Admin">;

const ASSIGN_ROLES: AssignRole[] = ["Captain", "Crew"];

interface AssignMemberDialogProps {
  vessel: Vessel;
  candidates: Profile[];
  rows: AssignmentRow[];
  initialProfileId?: string;
  /** Which role to pre-select; ignored when `initialProfileId` is given. */
  initialRole?: AssignRole;
  onClose: () => void;
}

/** Assigns a Captain or Crew member to a vessel (re-activating removed assignments). */
export function AssignMemberDialog({
  vessel,
  candidates,
  rows,
  initialProfileId,
  initialRole,
  onClose,
}: AssignMemberDialogProps) {
  const invalidate = useInvalidateAdminData();
  const preselected = candidates.find((candidate) => candidate.id === initialProfileId);
  const [role, setRole] = useState<AssignRole>(
    (preselected?.role as AssignRole | undefined) ?? initialRole ?? "Captain",
  );
  const [profileId, setProfileId] = useState(preselected?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const roleCandidates = candidates.filter((candidate) => candidate.role === role);
  const countFor = (value: AssignRole): number =>
    candidates.filter((candidate) => candidate.role === value).length;

  /** Names of the vessels a member is currently assigned to. */
  const vesselNamesOf = (memberId: string): string[] =>
    rows
      .filter((row) => row.profile_id === memberId && row.is_active)
      .map((row) => row.vessel?.name)
      .filter((name): name is string => Boolean(name));
  const vesselSummary = (memberId: string): string => {
    const names = vesselNamesOf(memberId);
    return names.length > 0 ? names.join(", ") : "Not assigned to any vessel";
  };
  const memberOptions: ComboboxOption[] = roleCandidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.full_name,
    description: vesselSummary(candidate.id),
  }));

  function changeRole(next: AssignRole): void {
    setRole(next);
    setProfileId("");
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profileId) {
        setError(
          role === "Crew" ? "Select a crew member to assign." : "Select a captain to assign.",
        );
        return null;
      }
      setError(null);
      const { error: rpcError } = await adminUpsertAssignment({
        p_id: resolveAssignmentId(rows, profileId, vessel.id),
        p_profile_id: profileId,
        p_vessel_id: vessel.id,
        p_is_active: true,
      });
      if (rpcError) {
        throw rpcError;
      }
      return candidates.find((candidate) => candidate.id === profileId) ?? null;
    },
    onSuccess: async (member) => {
      if (!member) {
        return;
      }
      toast.success(`${member.full_name} assigned to ${vessel.name}`);
      await invalidate();
      onClose();
    },
    onError: (rpcError) => setError(parseSupabaseError(rpcError)),
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign member to {vessel.name}</DialogTitle>
          <DialogDescription>
            Captains and Crew can only access work orders for vessels they are
            assigned to.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <p id="assign-role-label" className="text-sm font-medium">
              Assign as
            </p>
            <div
              role="radiogroup"
              aria-labelledby="assign-role-label"
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            >
              {ASSIGN_ROLES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => changeRole(value)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    role === value && "bg-card text-foreground shadow-xs",
                  )}
                >
                  {value === "Captain" ? (
                    <Anchor className="size-4" />
                  ) : (
                    <Wrench className="size-4" />
                  )}
                  {value}
                  <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">
                    {countFor(value)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <FormField
            id="assign-member"
            label={role === "Crew" ? "Crew member" : "Captain"}
            required
            error={error ?? undefined}
            hint={
              roleCandidates.length === 0
                ? `Every active ${role.toLowerCase()} is already on this vessel. Add more under Users & roles.`
                : undefined
            }
          >
            <Combobox
              id="assign-member"
              value={profileId}
              onValueChange={(value) => {
                setProfileId(value);
                setError(null);
              }}
              options={memberOptions}
              disabled={roleCandidates.length === 0}
              invalid={Boolean(error)}
              placeholder={role === "Crew" ? "Select a crew member" : "Select a captain"}
              searchPlaceholder={
                role === "Crew" ? "Search crew by name or vessel…" : "Search captains by name or vessel…"
              }
              emptyText={role === "Crew" ? "No crew match your search." : "No captains match your search."}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || roleCandidates.length === 0}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Assign
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MoveMemberDialogProps {
  assignment: AssignmentRow;
  vessels: Vessel[];
  rows: AssignmentRow[];
  onClose: () => void;
}

/** Updates a member's assignment by moving them to a different vessel. */
export function MoveMemberDialog({
  assignment,
  vessels,
  rows,
  onClose,
}: MoveMemberDialogProps) {
  const invalidate = useInvalidateAdminData();
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const member = assignment.profile;
  const targets = vessels.filter((vessel) => vessel.id !== assignment.vessel_id);
  const targetOptions: ComboboxOption[] = targets.map((vessel) => ({
    value: vessel.id,
    label: vessel.name,
    description: vessel.imo_number ? `IMO ${vessel.imo_number}` : undefined,
  }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!member || !targetId) {
        setError("Select the vessel to move them to.");
        return null;
      }
      const target = targets.find((vessel) => vessel.id === targetId);
      const existing = findAssignment(rows, member.id, targetId);
      if (existing?.is_active) {
        throw new Error(`${member.full_name} is already assigned to ${target?.name}.`);
      }
      setError(null);

      // Removal is guarded server-side (e.g. blocked while they own active work orders).
      const removed = await adminRemoveAssignment(assignment.id);
      if (removed.error) {
        throw removed.error;
      }
      const added = await adminUpsertAssignment({
        p_id: existing?.id ?? null,
        p_profile_id: member.id,
        p_vessel_id: targetId,
        p_is_active: true,
      });
      if (added.error) {
        throw new Error(
          `Removed from ${assignment.vessel?.name}, but could not assign to ${target?.name}: ${added.error.message}. Use Assign member to retry.`,
        );
      }
      return { member, target };
    },
    onSuccess: async (result) => {
      if (!result) {
        return;
      }
      toast.success(`${result.member.full_name} moved to ${result.target?.name}`);
      await invalidate();
      onClose();
    },
    onError: async (rpcError) => {
      setError(parseSupabaseError(rpcError));
      await invalidate();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {member?.full_name ?? "member"} to another vessel</DialogTitle>
          <DialogDescription>
            They will be removed from {assignment.vessel?.name} and assigned to the
            vessel you choose.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <FormField id="move-target" label="New vessel" required error={error ?? undefined}>
            <Combobox
              id="move-target"
              value={targetId}
              onValueChange={(value) => {
                setTargetId(value);
                setError(null);
              }}
              options={targetOptions}
              disabled={targets.length === 0}
              invalid={Boolean(error)}
              placeholder="Select vessel"
              searchPlaceholder="Search vessels by name or IMO…"
              emptyText="No vessels match your search."
              sheetTitle="Select vessel"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || targets.length === 0}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Move member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
