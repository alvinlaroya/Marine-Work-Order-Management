import { Anchor, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types/database";

const ROLE_STYLE = {
  Admin: { variant: "violet", icon: ShieldCheck },
  Captain: { variant: "info", icon: Anchor },
  Crew: { variant: "success", icon: Wrench },
} as const;

export function RoleBadge({ role }: { role: UserRole }) {
  const { variant, icon: Icon } = ROLE_STYLE[role];
  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {role}
    </Badge>
  );
}
