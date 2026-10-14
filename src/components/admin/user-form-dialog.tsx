"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAllVessels, useInvalidateAdminData } from "@/hooks/use-admin-data";
import { useSessionContext } from "@/hooks/use-session-context";
import { ROLE_OPTIONS, ROLE_SUMMARY } from "@/lib/permissions";
import { adminUpsertAssignment, adminUpsertProfile } from "@/lib/supabase/rpc";
import {
  clearFieldError,
  parseSupabaseError,
  profileFormSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";
import type { Profile, UserRole, Vessel } from "@/types/database";

interface UserFormDialogProps {
  /** The user being edited, or null to create a new one. */
  user: Profile | null;
  onClose: () => void;
}

/** Mount only while open so the form state always starts from the given user. */
export function UserFormDialog({ user, onClose }: UserFormDialogProps) {
  const invalidate = useInvalidateAdminData();
  const { profile } = useSessionContext();
  // Admins cannot change their own role (prevents accidental self-demotion).
  const isEditingSelf = Boolean(
    user && profile && profile.role === "Admin" && profile.id === user.id,
  );
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "Crew");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [vesselIds, setVesselIds] = useState<string[]>([]);

  const isCreating = user === null;
  // Admins have access to every vessel, so only Captains and Crew can be assigned.
  const canAssignVessels = isCreating && role !== "Admin";
  const vesselsQuery = useAllVessels();
  const activeVessels = (vesselsQuery.data ?? []).filter((vessel) => vessel.is_active);

  const vesselOptions: ComboboxOption[] = activeVessels
    .filter((vessel) => !vesselIds.includes(vessel.id))
    .map((vessel) => ({
      value: vessel.id,
      label: vessel.name,
      description: vessel.imo_number ? `IMO ${vessel.imo_number}` : undefined,
    }));
  const selectedVessels = vesselIds
    .map((id) => activeVessels.find((vessel) => vessel.id === id))
    .filter((vessel): vessel is Vessel => vessel !== undefined);

  const removeVessel = (vesselId: string): void =>
    setVesselIds((prev) => prev.filter((id) => id !== vesselId));

  /** Drops a field's error as soon as the user edits it (and any server error). */
  const clearError = (field: string) =>
    setErrors((prev) => clearFieldError(prev, field));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = profileFormSchema.safeParse({
        email,
        full_name: fullName,
        role,
        is_active: isActive,
      });
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        return null;
      }
      setErrors({});
      const { data: saved, error } = await adminUpsertProfile({
        p_id: user?.id ?? null,
        p_email: parsed.data.email,
        p_full_name: parsed.data.full_name,
        p_role: parsed.data.role,
        p_is_active: parsed.data.is_active,
      });
      if (error) {
        throw error;
      }

      // Optional: assign the newly created user to the selected vessels.
      const failedVessels: string[] = [];
      if (canAssignVessels && saved && vesselIds.length > 0) {
        for (const vesselId of vesselIds) {
          const { error: assignError } = await adminUpsertAssignment({
            p_id: null,
            p_profile_id: saved.id,
            p_vessel_id: vesselId,
            p_is_active: true,
          });
          if (assignError) {
            failedVessels.push(
              activeVessels.find((vessel) => vessel.id === vesselId)?.name ?? "Unknown vessel",
            );
          }
        }
      }
      return { failedVessels };
    },
    onSuccess: async (result) => {
      if (!result) {
        return;
      }
      if (result.failedVessels.length > 0) {
        // The user exists now, so close the dialog and point to the Assignments page.
        toast.warning("User created, but some vessel assignments failed", {
          description: `Could not assign to: ${result.failedVessels.join(", ")}. Assign them under Assignments.`,
          duration: 8000,
        });
      } else {
        toast.success(user ? "User updated" : "User created");
      }
      await invalidate();
      onClose();
    },
    onError: (error) => {
      const message = parseSupabaseError(error);
      setErrors(
        message.toLowerCase().includes("email")
          ? { email: message }
          : { form: message },
      );
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Update the profile or change the role. Role changes take effect immediately."
              : "Create a fleet member. Optionally assign them to one or more vessels now, or do it later under Assignments."}
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
          <FormField id="user-name" label="Full name" required error={errors.full_name}>
            <Input
              id="user-name"
              value={fullName}
              autoFocus
              aria-invalid={Boolean(errors.full_name)}
              onChange={(event) => {
                setFullName(event.target.value);
                clearError("full_name");
              }}
            />
          </FormField>
          <FormField id="user-email" label="Email" required error={errors.email}>
            <Input
              id="user-email"
              type="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="user-role"
              label="Role"
              required
              hint={
                isEditingSelf
                  ? "You can't change your own role."
                  : ROLE_SUMMARY[role]
              }
            >
              <Select
                value={role}
                disabled={isEditingSelf}
                onValueChange={(value) => setRole(value as UserRole)}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {user ? (
              <FormField id="user-status" label="Status">
                <Select
                  value={isActive ? "active" : "inactive"}
                  onValueChange={(value) => setIsActive(value === "active")}
                >
                  <SelectTrigger id="user-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
          </div>

          {canAssignVessels ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-vessels">
                Assign to vessels{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              {vesselsQuery.isPending ? (
                <p className="text-xs text-muted-foreground">Loading vessels…</p>
              ) : activeVessels.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active vessels yet. Add one under Vessels first.
                </p>
              ) : (
                <>
                  <Combobox
                    id="user-vessels"
                    ariaLabel="Assign to vessels"
                    // Picking a vessel adds it to the list below; the field itself stays empty.
                    value=""
                    onValueChange={(value) =>
                      setVesselIds((prev) => (prev.includes(value) ? prev : [...prev, value]))
                    }
                    options={vesselOptions}
                    disabled={vesselOptions.length === 0}
                    placeholder={
                      vesselOptions.length === 0 ? "All vessels selected" : "Search and add a vessel"
                    }
                    searchPlaceholder="Search vessels by name…"
                    emptyText="No vessels match your search."
                    sheetTitle="Select a vessel"
                  />
                  {selectedVessels.length > 0 ? (
                    <ul className="flex flex-wrap gap-2 pt-1" aria-label="Selected vessels">
                      {selectedVessels.map((vessel) => (
                        <li key={vessel.id}>
                          <button
                            type="button"
                            onClick={() => removeVessel(vessel.id)}
                            aria-label={`Remove ${vessel.name}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {vessel.name}
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                They will be assigned as {role === "Captain" ? "a Captain" : "Crew"} on each selected
                vessel.
              </p>
            </div>
          ) : null}

          {errors.form ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {user ? "Save changes" : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
