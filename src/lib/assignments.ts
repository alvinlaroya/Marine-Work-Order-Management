import type { AssignmentRow, Profile } from "@/types/database";

/** Finds the assignment row for a user and vessel, active or removed. */
export function findAssignment(
  rows: AssignmentRow[],
  profileId: string,
  vesselId: string,
): AssignmentRow | undefined {
  return rows.find(
    (row) => row.profile_id === profileId && row.vessel_id === vesselId,
  );
}

/**
 * Removed assignments are soft-deleted and keep their unique (user, vessel) key,
 * so re-assigning must reactivate that row instead of inserting a new one.
 */
export function resolveAssignmentId(
  rows: AssignmentRow[],
  profileId: string,
  vesselId: string,
): string | null {
  return findAssignment(rows, profileId, vesselId)?.id ?? null;
}

export function isActiveAssignment(row: AssignmentRow): boolean {
  return row.is_active && row.profile?.is_active === true;
}

/** Active Captains and Crew who can still be assigned to the vessel. */
export function assignableProfiles(
  profiles: Profile[],
  rows: AssignmentRow[],
  vesselId: string,
): Profile[] {
  return profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.role !== "Admin" &&
      !rows.some(
        (row) =>
          row.profile_id === profile.id &&
          row.vessel_id === vesselId &&
          row.is_active,
      ),
  );
}

/** Active Captains and Crew with no active vessel assignment at all. */
export function unassignedProfiles(
  profiles: Profile[],
  rows: AssignmentRow[],
): Profile[] {
  return profiles.filter(
    (profile) =>
      profile.is_active &&
      profile.role !== "Admin" &&
      !rows.some((row) => row.profile_id === profile.id && row.is_active),
  );
}
