import { z } from "zod";

export const profileFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters"),
  role: z.enum(["Admin", "Captain", "Crew"]),
  is_active: z.boolean(),
});

export const vesselFormSchema = z.object({
  name: z.string().trim().min(2, "Vessel name must be at least 2 characters"),
  imo_number: z.string().trim().optional(),
  is_active: z.boolean(),
});

export const workOrderFormSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  issue: z.string().trim().min(5, "Describe the issue (at least 5 characters)"),
  assigned_crew_id: z.guid("Select a crew member"),
});

export type FieldErrors = Record<string, string>;

/** Returns the errors without the given field and without any form-level error. */
export function clearFieldError(errors: FieldErrors, field: string): FieldErrors {
  const { [field]: _removed, form: _form, ...rest } = errors;
  void _removed;
  void _form;
  return rest;
}

/** Maps zod issues to a `{ field: message }` record for inline form errors. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export function parseSupabaseError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message);
  }
  return "Unexpected error";
}
