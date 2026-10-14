import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkOrder } from "@/types/database";

const STEPS = ["Open", "In Progress", "Done", "Attested"] as const;

function currentStep(order: WorkOrder): number {
  if (order.is_closed) {
    return STEPS.length;
  }
  if (order.status === "Done") {
    return 2;
  }
  return order.status === "In Progress" ? 1 : 0;
}

/** Visual lifecycle: Open, In Progress, Done, then Captain attestation. */
export function ProgressStepper({ order }: { order: WorkOrder }) {
  const current = currentStep(order);

  return (
    <ol className="flex items-start" aria-label="Work order progress">
      {STEPS.map((label, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2",
                  index <= current ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                complete && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-card text-primary ring-4 ring-primary/15",
                !complete && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {complete ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                complete || active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
