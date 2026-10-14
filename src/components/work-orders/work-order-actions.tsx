"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Hourglass, Loader2, Play, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/query-keys";
import {
  captainAttestWorkOrder,
  captainRejectWorkOrder,
  crewUpdateWorkOrder,
} from "@/lib/supabase/rpc";
import { parseSupabaseError } from "@/lib/validation";
import type { WorkOrderRow } from "@/types/database";

/** Refreshes the order, the lists it appears in, and its review history. */
function useRefreshWorkOrder(workOrderId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(workOrderId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.rejections(workOrderId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.events(workOrderId) }),
    ]);
  };
}

function InfoPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Hourglass;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="space-y-0.5">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{children}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CrewActions({ order }: { order: WorkOrderRow }) {
  const refresh = useRefreshWorkOrder(order.id);
  const [solution, setSolution] = useState(order.solution ?? "");

  const start = useMutation({
    mutationFn: async () => {
      const { error } = await crewUpdateWorkOrder({
        p_work_order_id: order.id,
        p_status: "In Progress",
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Work started. Document the solution when you are done.");
      await refresh();
    },
    onError: (error) => toast.error(parseSupabaseError(error)),
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await crewUpdateWorkOrder({
        p_work_order_id: order.id,
        p_status: "Done",
        p_solution: solution.trim(),
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Marked as Done and sent to the Captain for review.");
      await refresh();
    },
    onError: (error) => toast.error(parseSupabaseError(error)),
  });

  if (order.is_closed) {
    return (
      <InfoPanel icon={CheckCheck} title="Attested and closed">
        The Captain approved this work order. No further action is needed.
      </InfoPanel>
    );
  }

  if (order.status === "Done") {
    return (
      <InfoPanel icon={Hourglass} title="Waiting for Captain review">
        You marked this work order as Done. The Captain will attest it or send it
        back with comments.
      </InfoPanel>
    );
  }

  if (order.status === "Open") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ready to start?</CardTitle>
          <CardDescription>
            Move this work order to In Progress to begin. You will document the
            solution before marking it Done.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            Start work
          </Button>
        </CardContent>
      </Card>
    );
  }

  const trimmed = solution.trim();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document the solution</CardTitle>
        <CardDescription>
          Describe what you did to resolve the issue, then mark the work order
          Done for Captain review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField id="solution" label="Solution" required>
          <Textarea
            id="solution"
            value={solution}
            onChange={(event) => setSolution(event.target.value)}
            placeholder="e.g. Replaced the worn coupling and re-balanced the shaft."
            className="min-h-32"
          />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => complete.mutate()}
            disabled={complete.isPending || trimmed.length === 0}
          >
            {complete.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Mark as Done
          </Button>
          {trimmed.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              A solution is required before you can mark this Done.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function CaptainReview({ order }: { order: WorkOrderRow }) {
  const refresh = useRefreshWorkOrder(order.id);
  const [attestOpen, setAttestOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const attest = useMutation({
    mutationFn: async () => {
      const { error } = await captainAttestWorkOrder(order.id);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Work order attested and closed.");
      setAttestOpen(false);
      await refresh();
    },
    onError: (error) => toast.error(parseSupabaseError(error)),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await captainRejectWorkOrder({
        p_work_order_id: order.id,
        p_reason: reason.trim(),
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Sent back to the crew with your comments.");
      setRejectOpen(false);
      setReason("");
      await refresh();
    },
    onError: (error) => toast.error(parseSupabaseError(error)),
  });

  function submitRejection(): void {
    if (reason.trim().length < 3) {
      setReasonError("A rejection reason is required so the crew knows what to fix.");
      return;
    }
    setReasonError(null);
    reject.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Captain review</CardTitle>
        <CardDescription>
          The crew marked this work order Done. Attest to approve and close it, or
          reject it with a reason to send it back.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={() => setAttestOpen(true)}>
          <CheckCheck />
          Attest and close
        </Button>
        <Button variant="outline" onClick={() => setRejectOpen(true)}>
          <RotateCcw />
          Reject
        </Button>
      </CardContent>

      <ConfirmDialog
        open={attestOpen}
        onOpenChange={setAttestOpen}
        title="Attest this work order?"
        description="This approves the solution and fully closes the record. It cannot be reopened."
        confirmLabel="Attest and close"
        pending={attest.isPending}
        onConfirm={() => attest.mutate()}
      />

      <Dialog
        open={rejectOpen}
        onOpenChange={(next) => {
          setRejectOpen(next);
          if (!next) {
            setReasonError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject and return to crew</DialogTitle>
            <DialogDescription>
              The work order goes back to {order.assignee?.full_name ?? "the assigned crew"}{" "}
              as In Progress. Your comment is required.
            </DialogDescription>
          </DialogHeader>
          <FormField id="reject-reason" label="Rejection reason" required error={reasonError ?? undefined}>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(null);
              }}
              placeholder="What still needs to be fixed or documented?"
              aria-invalid={Boolean(reasonError)}
              className="min-h-28"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={reject.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitRejection} disabled={reject.isPending}>
              {reject.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              Reject work order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
