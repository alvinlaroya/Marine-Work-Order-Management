"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvalidateAdminData } from "@/hooks/use-admin-data";
import { adminUpsertVessel } from "@/lib/supabase/rpc";
import {
  clearFieldError,
  parseSupabaseError,
  toFieldErrors,
  vesselFormSchema,
  type FieldErrors,
} from "@/lib/validation";
import type { Vessel } from "@/types/database";

interface VesselFormDialogProps {
  /** The vessel being edited, or null to create a new one. */
  vessel: Vessel | null;
  onClose: () => void;
}

/** Mount only while open so the form state always starts from the given vessel. */
export function VesselFormDialog({ vessel, onClose }: VesselFormDialogProps) {
  const invalidate = useInvalidateAdminData();
  const [name, setName] = useState(vessel?.name ?? "");
  const [imo, setImo] = useState(vessel?.imo_number ?? "");
  const [isActive, setIsActive] = useState(vessel?.is_active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Drops a field's error as soon as the user edits it (and any server error). */
  const clearError = (field: string) =>
    setErrors((prev) => clearFieldError(prev, field));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = vesselFormSchema.safeParse({
        name,
        imo_number: imo,
        is_active: isActive,
      });
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        return false;
      }
      setErrors({});
      const { error } = await adminUpsertVessel({
        p_id: vessel?.id ?? null,
        p_name: parsed.data.name,
        p_imo_number: parsed.data.imo_number ? parsed.data.imo_number : null,
        p_is_active: parsed.data.is_active,
      });
      if (error) {
        throw error;
      }
      return true;
    },
    onSuccess: async (saved) => {
      if (!saved) {
        return;
      }
      toast.success(vessel ? "Vessel updated" : "Vessel created");
      await invalidate();
      onClose();
    },
    onError: (error) => {
      const message = parseSupabaseError(error);
      const lower = message.toLowerCase();
      setErrors(
        lower.includes("duplicate") || lower.includes("name") || lower.includes("imo")
          ? { name: message }
          : { form: message },
      );
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vessel ? "Edit vessel" : "Add vessel"}</DialogTitle>
          <DialogDescription>
            Vessel names and IMO numbers must be unique across the fleet.
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
          <FormField id="vessel-name" label="Vessel name" required error={errors.name}>
            <Input
              id="vessel-name"
              value={name}
              autoFocus
              placeholder="e.g. MV Ocean Star"
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => {
                setName(event.target.value);
                clearError("name");
              }}
            />
          </FormField>
          <FormField
            id="vessel-imo"
            label="IMO number"
            hint="Optional. Seven digits, for example IMO9123456."
            error={errors.imo_number}
          >
            <Input
              id="vessel-imo"
              value={imo}
              onChange={(event) => {
                setImo(event.target.value);
                clearError("imo_number");
              }}
            />
          </FormField>
          {vessel ? (
            <FormField id="vessel-status" label="Status">
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) => setIsActive(value === "active")}
              >
                <SelectTrigger id="vessel-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
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
              {vessel ? "Save changes" : "Create vessel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
