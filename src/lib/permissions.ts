import type { Profile, UserRole, WorkOrder } from "@/types/database";

export function canManageAdmin(profile: Profile | null): boolean {
  return profile?.role === "Admin" && profile.is_active;
}

export function canCreateWorkOrder(profile: Profile | null): boolean {
  return profile?.role === "Captain" && profile.is_active;
}

export function canReviewWorkOrder(
  profile: Profile | null,
  workOrder: WorkOrder,
): boolean {
  return (
    (profile?.role === "Captain" || profile?.role === "Admin") &&
    profile.is_active &&
    workOrder.status === "Done" &&
    !workOrder.is_closed
  );
}

export function canCrewUpdateWorkOrder(
  profile: Profile | null,
  workOrder: WorkOrder,
): boolean {
  return (
    profile?.role === "Crew" &&
    profile.is_active &&
    workOrder.assigned_crew_id === profile.id &&
    !workOrder.is_closed
  );
}

export const ROLE_OPTIONS: UserRole[] = ["Admin", "Captain", "Crew"];

export const ROLE_SUMMARY: Record<UserRole, string> = {
  Admin: "Manage users, roles, vessels and assignments across the fleet.",
  Captain: "Create work orders, assign crew, then attest or reject completed work.",
  Crew: "Work your assigned orders, document the solution and mark them done.",
};
