import { describe, expect, it } from "vitest";

import {
  assignableProfiles,
  findAssignment,
  isActiveAssignment,
  resolveAssignmentId,
  unassignedProfiles,
} from "@/lib/assignments";
import type { AssignmentRow, Profile } from "@/types/database";

const profile = (id: string, role: Profile["role"], is_active = true): Profile =>
  ({ id, role, is_active, full_name: id, email: `${id}@x.com` }) as Profile;

const row = (
  id: string,
  profile_id: string,
  vessel_id: string,
  is_active = true,
  member?: Profile,
): AssignmentRow =>
  ({
    id,
    profile_id,
    vessel_id,
    is_active,
    profile: member ?? profile(profile_id, "Crew"),
  }) as AssignmentRow;

describe("findAssignment", () => {
  it("locates a row by profile and vessel", () => {
    const rows = [row("a1", "p1", "v1")];
    expect(findAssignment(rows, "p1", "v1")?.id).toBe("a1");
    expect(findAssignment(rows, "p2", "v1")).toBeUndefined();
  });
});

describe("resolveAssignmentId", () => {
  it("reuses a removed assignment row and returns null when none exists", () => {
    const rows = [row("a1", "p1", "v1", false)];
    expect(resolveAssignmentId(rows, "p1", "v1")).toBe("a1");
    expect(resolveAssignmentId(rows, "p1", "v2")).toBeNull();
  });
});

describe("isActiveAssignment", () => {
  it("requires both the assignment and the user to be active", () => {
    expect(isActiveAssignment(row("a", "p", "v"))).toBe(true);
    expect(isActiveAssignment(row("a", "p", "v", false))).toBe(false);
    expect(
      isActiveAssignment(row("a", "p", "v", true, profile("p", "Crew", false))),
    ).toBe(false);
  });
});

describe("assignableProfiles", () => {
  const profiles = [
    profile("admin", "Admin"),
    profile("cap", "Captain"),
    profile("crew", "Crew"),
    profile("gone", "Crew", false),
  ];

  it("excludes admins, inactive users and members already on the vessel", () => {
    const rows = [row("a1", "cap", "v1")];
    expect(assignableProfiles(profiles, rows, "v1").map((p) => p.id)).toEqual(["crew"]);
  });

  it("offers members whose assignment was removed", () => {
    const rows = [row("a1", "cap", "v1", false)];
    expect(assignableProfiles(profiles, rows, "v1").map((p) => p.id)).toEqual([
      "cap",
      "crew",
    ]);
  });
});

describe("unassignedProfiles", () => {
  it("lists active non-admin members with no active assignment", () => {
    const profiles = [
      profile("admin", "Admin"),
      profile("cap", "Captain"),
      profile("crew", "Crew"),
    ];
    const rows = [row("a1", "cap", "v1")];
    expect(unassignedProfiles(profiles, rows).map((p) => p.id)).toEqual(["crew"]);
  });
});
