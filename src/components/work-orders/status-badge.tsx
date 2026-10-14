import { CheckCheck, CircleDot, Hourglass, Loader } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WorkOrderStatus } from "@/types/database";

interface StatusBadgeProps {
  status: WorkOrderStatus;
  /** True once the Captain has attested the order. */
  closed?: boolean;
}

export function StatusBadge({ status, closed = false }: StatusBadgeProps) {
  if (status === "Open") {
    return (
      <Badge variant="info">
        <CircleDot className="size-3" />
        Open
      </Badge>
    );
  }

  if (status === "In Progress") {
    return (
      <Badge variant="warning">
        <Loader className="size-3" />
        In Progress
      </Badge>
    );
  }

  if (closed) {
    return (
      <Badge variant="success">
        <CheckCheck className="size-3" />
        Done · Attested
      </Badge>
    );
  }

  return (
    <Badge variant="violet">
      <Hourglass className="size-3" />
      Done · Awaiting review
    </Badge>
  );
}
