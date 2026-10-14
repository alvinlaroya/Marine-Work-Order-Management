import { AdminRouteRedirect } from "@/components/layout/admin-route-redirect";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MockAuthBar } from "@/components/layout/mock-auth-bar";
import { SessionGate } from "@/components/layout/session-gate";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AdminRouteRedirect />
      <MockAuthBar />
      <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-4 md:px-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-40 py-8 lg:top-24">
            <SidebarNav />
          </div>
        </aside>
        <main
          id="main-content"
          className="min-w-0 flex-1 py-6 pb-28 md:py-8 md:pb-12"
        >
          <SessionGate>{children}</SessionGate>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
