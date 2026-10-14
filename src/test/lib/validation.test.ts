import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  clearFieldError,
  parseSupabaseError,
  profileFormSchema,
  toFieldErrors,
  vesselFormSchema,
  workOrderFormSchema,
} from "@/lib/validation";

describe("validation", () => {
  it("parses supabase-like errors", () => {
    expect(parseSupabaseError({ message: "Duplicate user email" })).toBe(
      "Duplicate user email",
    );
    expect(parseSupabaseError(null)).toBe("Unexpected error");
  });

  it("maps zod issues to field errors and clears them", () => {
    const parsed = profileFormSchema.safeParse({
      email: "bad",
      full_name: "A",
      role: "Crew",
      is_active: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      expect(errors.email).toBeTruthy();
      expect(clearFieldError(errors, "email")).not.toHaveProperty("email");
      expect(clearFieldError(errors, "email")).not.toHaveProperty("form");
    }
  });

  it("validates profile and vessel forms", () => {
    expect(
      profileFormSchema.safeParse({
        email: "crew@fleet.local",
        full_name: "Sam Rivera",
        role: "Crew",
        is_active: true,
      }).success,
    ).toBe(true);
    expect(
      vesselFormSchema.safeParse({ name: "MV Test", imo_number: "123", is_active: true })
        .success,
    ).toBe(true);
    expect(vesselFormSchema.safeParse({ name: "X", is_active: true }).success).toBe(false);
  });

  it("requires crew assignment for work orders", () => {
    const result = workOrderFormSchema.safeParse({
      title: "Fix pump",
      issue: "Pump leaking in engine room",
      assigned_crew_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the seeded crew ids, which are not strict RFC-4122 UUIDs", () => {
    const result = workOrderFormSchema.safeParse({
      title: "Fix pump",
      issue: "Pump leaking in engine room",
      assigned_crew_id: "22222222-2222-2222-2222-222222222205",
    });
    expect(result.success).toBe(true);
  });

  it("uses form as the fallback field key", () => {
    const error = new z.ZodError([{ code: "custom", message: "Bad form", path: [] }]);
    expect(toFieldErrors(error).form).toBe("Bad form");
  });
});
