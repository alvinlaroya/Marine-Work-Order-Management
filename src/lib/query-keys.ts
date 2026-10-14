/**
 * Query keys are prefix-matchable: calling a helper without a scope returns the
 * bare prefix (e.g. ["vessels"]) so `invalidateQueries` refreshes every scoped
 * variant of that resource.
 */
function key(resource: string, ...scope: Array<string | null | undefined>) {
  const parts = scope.filter((part): part is string => Boolean(part));
  return [resource, ...parts] as const;
}

export const queryKeys = {
  session: ["session"] as const,
  assignedVessels: (profileId?: string) => key("assignedVessels", profileId),
  vessels: (scope?: string) => key("vessels", scope),
  profiles: (scope?: string) => key("profiles", scope),
  assignments: (scope?: string) => key("assignments", scope),
  workOrders: (profileId?: string, vesselId?: string | null) =>
    key("workOrders", profileId, vesselId),
  workOrder: (id: string, profileId?: string) =>
    key("workOrder", id, profileId),
  rejections: (workOrderId: string) => key("rejections", workOrderId),
  events: (workOrderId: string) => key("events", workOrderId),
  counts: (scope?: string) => key("counts", scope),
};
