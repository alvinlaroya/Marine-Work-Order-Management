"use client";

import { useMutation } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminGuard } from "@/components/admin/admin-guard";
import { UserFormDialog } from "@/components/admin/user-form-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { QueryError } from "@/components/common/query-error";
import { RoleBadge } from "@/components/common/role-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAllAssignments,
  useAllProfiles,
  useInvalidateAdminData,
} from "@/hooks/use-admin-data";
import { ROLE_OPTIONS } from "@/lib/permissions";
import { adminDeactivateProfile, adminUpsertProfile } from "@/lib/supabase/rpc";
import { cn } from "@/lib/utils";
import { parseSupabaseError } from "@/lib/validation";
import type { Profile, UserRole } from "@/types/database";

type RoleTab = "all" | UserRole;

const PAGE_SIZE = 10;

interface UserActionsProps {
  user: Profile;
  onEdit: (user: Profile) => void;
  onDeactivate: (user: Profile) => void;
  onReactivate: (user: Profile) => void;
}

function UserActions({ user, onEdit, onDeactivate, onReactivate }: UserActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${user.full_name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(user)}>
          <Pencil />
          Edit user or role
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.is_active ? (
          <DropdownMenuItem destructive onSelect={() => onDeactivate(user)}>
            <UserX />
            Deactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onReactivate(user)}>
            <UserCheck />
            Reactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success">Active</Badge>
  ) : (
    <Badge variant="muted">Inactive</Badge>
  );
}

function VesselBadges({ names, isAdmin }: { names: string[]; isAdmin: boolean }) {
  if (isAdmin) {
    return <span className="text-xs text-muted-foreground">All vessels</span>;
  }
  if (names.length === 0) {
    return <span className="text-xs text-muted-foreground">No vessel</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((name) => (
        <Badge key={name} variant="outline">
          {name}
        </Badge>
      ))}
    </div>
  );
}

function UsersContent() {
  const profilesQuery = useAllProfiles();
  const assignmentsQuery = useAllAssignments();
  const invalidate = useInvalidateAdminData();
  const [tab, setTab] = useState<RoleTab>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formUser, setFormUser] = useState<Profile | null | "new">(null);
  const [toDeactivate, setToDeactivate] = useState<Profile | null>(null);

  const users = profilesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const vesselNames = (profileId: string): string[] =>
    assignments
      .filter((row) => row.profile_id === profileId && row.is_active)
      .map((row) => row.vessel?.name ?? "Unknown vessel");

  const deactivate = useMutation({
    mutationFn: async (user: Profile) => {
      const { error } = await adminDeactivateProfile(user.id);
      if (error) {
        throw error;
      }
      return user;
    },
    onSuccess: async (user) => {
      toast.success(`${user.full_name} deactivated`);
      setToDeactivate(null);
      await invalidate();
    },
    onError: (error) => {
      setToDeactivate(null);
      toast.error("Could not deactivate user", {
        description: parseSupabaseError(error),
        duration: 8000,
      });
    },
  });

  const reactivate = useMutation({
    mutationFn: async (user: Profile) => {
      const { error } = await adminUpsertProfile({
        p_id: user.id,
        p_email: user.email,
        p_full_name: user.full_name,
        p_role: user.role,
        p_is_active: true,
      });
      if (error) {
        throw error;
      }
      return user;
    },
    onSuccess: async (user) => {
      toast.success(`${user.full_name} reactivated. Re-assign them to a vessel if needed.`);
      await invalidate();
    },
    onError: (error) => toast.error(parseSupabaseError(error)),
  });

  const needle = search.trim().toLowerCase();
  const visible = users.filter(
    (user) =>
      (tab === "all" || user.role === tab) &&
      (needle === "" ||
        user.full_name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)),
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp so the page stays valid if the list shrinks (e.g. after a refetch).
  const currentPage = Math.min(page, totalPages);
  const pageUsers = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const countFor = (value: RoleTab): number =>
    users.filter((user) => value === "all" || user.role === value).length;

  const actionProps = {
    onEdit: (user: Profile) => setFormUser(user),
    onDeactivate: (user: Profile) => setToDeactivate(user),
    onReactivate: (user: Profile) => reactivate.mutate(user),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Create, update and deactivate fleet members, and assign their role. Deactivation is blocked when it would leave work orders without an owner."
        actions={
          <Button onClick={() => setFormUser("new")}>
            <Plus />
            Add user
          </Button>
        }
      />

      {profilesQuery.isError ? (
        <QueryError
          error={profilesQuery.error}
          title="Could not load users"
          onRetry={() => void profilesQuery.refetch()}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Tabs value={tab} onValueChange={(value) => {
                  setTab(value as RoleTab);
                  setPage(1);
                }}
              >
                <TabsList>
                  {(["all", ...ROLE_OPTIONS] as RoleTab[]).map((value) => (
                    <TabsTrigger key={value} value={value}>
                      {value === "all" ? "Everyone" : value}
                      <span
                        className={cn(
                          "rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums",
                          tab === value && "bg-primary/10 text-primary",
                        )}
                      >
                        {profilesQuery.isPending ? "–" : countFor(value)}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email"
              aria-label="Search users"
              className="lg:max-w-xs"
            />
          </div>

          {profilesQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={users.length === 0 ? Users : SearchX}
                title={users.length === 0 ? "No users yet" : "No matching users"}
                description={
                  users.length === 0
                    ? "Add the first user to get started."
                    : "Try another role tab or clear the search."
                }
              />
            </Card>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {pageUsers.map((user) => (
                  <Card
                    key={user.id}
                    className={cn("p-4", !user.is_active && "opacity-70")}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={user.full_name} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="truncate font-medium">{user.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <RoleBadge role={user.role} />
                          <StatusPill active={user.is_active} />
                        </div>
                        <VesselBadges
                          names={vesselNames(user.id)}
                          isAdmin={user.role === "Admin"}
                        />
                      </div>
                      <UserActions user={user} {...actionProps} />
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="hidden overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Vessels</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className={cn(!user.is_active && "opacity-70")}
                      >
                        <TableCell className="py-3 pl-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.full_name} />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{user.full_name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell className="max-w-64">
                          <VesselBadges
                            names={vesselNames(user.id)}
                            isAdmin={user.role === "Admin"}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusPill active={user.is_active} />
                        </TableCell>
                        <TableCell className="pr-3">
                          <UserActions user={user} {...actionProps} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={visible.length}
                onPageChange={setPage}
                itemLabel="user"
              />
            </>
          )}
        </>
      )}

      {formUser !== null ? (
        <UserFormDialog
          key={formUser === "new" ? "new" : formUser.id}
          user={formUser === "new" ? null : formUser}
          onClose={() => setFormUser(null)}
        />
      ) : null}

      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => (!open ? setToDeactivate(null) : undefined)}
        title={`Deactivate ${toDeactivate?.full_name ?? "user"}?`}
        description="They will disappear from the member switcher and lose their vessel assignments. This is blocked if they own active work orders or are a vessel's only Captain."
        confirmLabel="Deactivate"
        destructive
        pending={deactivate.isPending}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate)}
      />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <UsersContent />
    </AdminGuard>
  );
}
