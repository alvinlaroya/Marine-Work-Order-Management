/** Primary workspace landing page for all roles. */
export const OVERVIEW_PATH = "/dashboard";

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
