"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/common/form-field";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessionContext } from "@/hooks/use-session-context";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createWorkOrder } from "@/lib/supabase/rpc";
import {
  clearFieldError,
  parseSupabaseError,
  toFieldErrors,
  workOrderFormSchema,
  type FieldErrors,
} from "@/lib/validation";
import type { Profile } from "@/types/database";

async function fetchVesselCrew(vesselId: string): Promise<Profile[]> {
  const supabase = getSupabaseBrowserClient();
  const { data: assignments, error: assignmentError } = await supabase
    .from("vessel_assignments")
    .select("profile_id")
    .eq("vessel_id", vesselId)
    .eq("is_active", true);
  if (assignmentError) {
    throw assignmentError;
  }
  const ids = (assignments ?? []).map((row: { profile_id: string }) => row.profile_id);
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids)
    .eq("role", "Crew")
    .eq("is_active", true)
    .order("full_name");
  if (error) {
    throw error;
  }
  return data as Profile[];
}

interface CrewWorkload {
  open: number;
  inProgress: number;
}

/** Counts each crew member's Open and In Progress orders on this vessel. */
async function fetchCrewWorkload(vesselId: string): Promise<Record<string, CrewWorkload>> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select("assigned_crew_id, status")
    .eq("vessel_id", vesselId)
    .in("status", ["Open", "In Progress"]);
  if (error) {
    throw error;
  }
  const workload: Record<string, CrewWorkload> = {};
  for (const row of (data ?? []) as Array<{ assigned_crew_id: string | null; status: string }>) {
    if (!row.assigned_crew_id) {
      continue;
    }
    const entry = (workload[row.assigned_crew_id] ??= { open: 0, inProgress: 0 });
    if (row.status === "Open") {
      entry.open += 1;
    } else {
      entry.inProgress += 1;
    }
  }
  return workload;
}

interface CreateWorkOrderDialogProps {
  vesselId: string;
  vesselName: string;
  trigger?: React.ReactNode;
}

export function CreateWorkOrderDialog({
  vesselId,
  vesselName,
  trigger,
}: CreateWorkOrderDialogProps) {
  const queryClient = useQueryClient();
  const { profile } = useSessionContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [issue, setIssue] = useState("");
  const [crewId, setCrewId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const crewQuery = useQuery({
    queryKey: queryKeys.profiles(`crew-${vesselId}`),
    queryFn: () => fetchVesselCrew(vesselId),
    enabled: open,
  });
  const crew = crewQuery.data ?? [];

  const workloadQuery = useQuery({
    queryKey: queryKeys.workOrders("crew-load", vesselId),
    queryFn: () => fetchCrewWorkload(vesselId),
    enabled: open,
  });
  const workload = workloadQuery.data ?? {};

  const crewOptions: ComboboxOption[] = crew.map((member) => {
    const load = workload[member.id] ?? { open: 0, inProgress: 0 };
    return {
      value: member.id,
      label: member.full_name,
      trailing: workloadQuery.isPending ? (
        <span className="text-xs text-muted-foreground">…</span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className={cn(badgeVariants({ variant: "info" }))}>{load.open} Open</span>
          <span className={cn(badgeVariants({ variant: "warning" }))}>
            {load.inProgress} In Progress
          </span>
        </span>
      ),
    };
  });

  /** Drops a field's error as soon as the user edits it (and any server error). */
  const clearError = (field: string) =>
    setErrors((prev) => clearFieldError(prev, field));

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = workOrderFormSchema.safeParse({
        title,
        issue,
        assigned_crew_id: crewId,
      });
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error));
        return false;
      }
      setErrors({});
      const { error } = await createWorkOrder({
        p_title: parsed.data.title,
        p_issue: parsed.data.issue,
        p_vessel_id: vesselId,
        p_assigned_crew_id: parsed.data.assigned_crew_id,
      });
      if (error) {
        throw error;
      }
      return true;
    },
    onSuccess: async (created) => {
      if (!created) {
        return;
      }
      toast.success("Work order created and assigned");
      setOpen(false);
      setTitle("");
      setIssue("");
      setCrewId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() });
    },
    onError: (error) => setErrors({ form: parseSupabaseError(error) }),
  });

  if (profile?.role !== "Captain") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setErrors({});
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            New work order
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
          <DialogDescription>
            Create an order for {vesselName} and assign it to a crew member. It
            starts as Open.
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
          <FormField id="wo-title" label="Title" required error={errors.title}>
            <Input
              id="wo-title"
              value={title}
              maxLength={120}
              placeholder="e.g. Port engine vibration"
              aria-invalid={Boolean(errors.title)}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
            />
          </FormField>
          <FormField id="wo-issue" label="Issue" required error={errors.issue}>
            <Textarea
              id="wo-issue"
              value={issue}
              placeholder="Describe what is wrong and where."
              aria-invalid={Boolean(errors.issue)}
              onChange={(event) => {
                setIssue(event.target.value);
                clearError("issue");
              }}
            />
          </FormField>
          <FormField
            id="wo-crew"
            label="Assign to crew"
            required
            error={errors.assigned_crew_id}
            hint={
              !crewQuery.isPending && crew.length === 0
                ? "No crew are assigned to this vessel yet. An Admin can add them under Assignments."
                : undefined
            }
          >
            <Combobox
              id="wo-crew"
              value={crewId}
              onValueChange={(value) => {
                setCrewId(value);
                clearError("assigned_crew_id");
              }}
              options={crewOptions}
              disabled={crew.length === 0}
              invalid={Boolean(errors.assigned_crew_id)}
              placeholder={crewQuery.isPending ? "Loading crew…" : "Select crew member"}
              searchPlaceholder="Search crew by name…"
              emptyText="No crew match your search."
            />
          </FormField>

          {errors.form ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.form}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Create work order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
