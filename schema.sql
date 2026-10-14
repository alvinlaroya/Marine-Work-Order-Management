-- Marine Work Order Management — schema, RLS, RPCs

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type public.user_role as enum ('Admin', 'Captain', 'Crew');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.work_order_status as enum ('Open', 'In Progress', 'Done');
exception when duplicate_object then null;
end $$;

-- Profiles (mock users — not Supabase email auth)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower on public.profiles (lower(trim(email)));

create table if not exists public.vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  imo_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vessels_name_unique unique (name),
  constraint vessels_imo_unique unique (imo_number)
);

create unique index if not exists vessels_name_lower on public.vessels (lower(trim(name)));

create table if not exists public.vessel_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  vessel_id uuid not null references public.vessels (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vessel_assignments_profile_vessel_unique unique (profile_id, vessel_id)
);

create sequence if not exists public.work_order_number_seq;

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text not null unique,
  title text not null,
  issue text not null,
  solution text,
  status public.work_order_status not null default 'Open',
  vessel_id uuid not null references public.vessels (id) on delete restrict,
  assigned_crew_id uuid not null references public.profiles (id) on delete restrict,
  created_by_id uuid not null references public.profiles (id) on delete restrict,
  attested_at timestamptz,
  attested_by_id uuid references public.profiles (id) on delete restrict,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_solution_when_done check (
    status <> 'Done' or (solution is not null and length(trim(solution)) > 0)
  )
);

create table if not exists public.work_order_rejections (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  rejected_by_id uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint work_order_rejections_reason_nonempty check (length(trim(reason)) > 0)
);

-- Crew activity log (started / completed) shown in each order's history timeline
create table if not exists public.work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null check (event_type in ('started', 'completed')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_work_order_events_order on public.work_order_events (work_order_id);

-- Maps anonymous Supabase auth user → impersonated profile + UI vessel scope
create table if not exists public.mock_sessions (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  active_profile_id uuid not null references public.profiles (id) on delete restrict,
  active_vessel_id uuid references public.vessels (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists idx_vessel_assignments_vessel on public.vessel_assignments (vessel_id) where is_active;
create index if not exists idx_vessel_assignments_profile on public.vessel_assignments (profile_id) where is_active;
create index if not exists idx_work_orders_vessel on public.work_orders (vessel_id);
create index if not exists idx_work_orders_assigned_crew on public.work_orders (assigned_crew_id);
create index if not exists idx_work_orders_status on public.work_orders (status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists vessels_updated_at on public.vessels;
create trigger vessels_updated_at before update on public.vessels
for each row execute function public.set_updated_at();

drop trigger if exists vessel_assignments_updated_at on public.vessel_assignments;
create trigger vessel_assignments_updated_at before update on public.vessel_assignments
for each row execute function public.set_updated_at();

drop trigger if exists work_orders_updated_at on public.work_orders;
create trigger work_orders_updated_at before update on public.work_orders
for each row execute function public.set_updated_at();

-- Work order number
create or replace function public.generate_work_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.work_order_number is null or new.work_order_number = '' then
    new.work_order_number := 'WO-' || lpad(nextval('public.work_order_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists work_orders_number on public.work_orders;
create trigger work_orders_number before insert on public.work_orders
for each row execute function public.generate_work_order_number();

-- Session helpers (security definer for RLS)
create or replace function public.current_auth_uid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ms.active_profile_id
  from public.mock_sessions ms
  where ms.auth_user_id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = public.current_profile_id();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'Admin', false);
$$;

create or replace function public.profile_assigned_to_vessel(p_profile_id uuid, p_vessel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vessel_assignments va
    join public.profiles p on p.id = va.profile_id
    where va.profile_id = p_profile_id
      and va.vessel_id = p_vessel_id
      and va.is_active
      and p.is_active
      and p.role in ('Captain', 'Crew')
  );
$$;

create or replace function public.can_access_vessel(p_vessel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or public.profile_assigned_to_vessel(public.current_profile_id(), p_vessel_id);
$$;

create or replace function public.active_vessel_scope()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ms.active_vessel_id
  from public.mock_sessions ms
  where ms.auth_user_id = auth.uid();
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.vessels enable row level security;
alter table public.vessel_assignments enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_rejections enable row level security;
alter table public.work_order_events enable row level security;
alter table public.mock_sessions enable row level security;

-- Profiles: read scoped; writes via RPC
drop policy if exists profiles_reviewer_read on public.profiles;
create policy profiles_reviewer_read on public.profiles for select to authenticated
using (is_active or public.is_admin());

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  public.is_admin()
  or id = public.current_profile_id()
  or (
    public.current_role() = 'Captain'
    and exists (
      select 1 from public.vessel_assignments va1
      join public.vessel_assignments va2 on va1.vessel_id = va2.vessel_id
      where va1.profile_id = public.current_profile_id()
        and va1.is_active
        and va2.profile_id = profiles.id
        and va2.is_active
    )
  )
  or (
    public.current_role() = 'Crew'
    and id = public.current_profile_id()
  )
);

drop policy if exists vessels_reviewer_read on public.vessels;
create policy vessels_reviewer_read on public.vessels for select to authenticated
using (is_active or public.is_admin());

drop policy if exists vessels_select on public.vessels;
create policy vessels_select on public.vessels for select to authenticated
using (
  public.is_admin()
  or (
    is_active
    and public.can_access_vessel(id)
  )
);

drop policy if exists vessel_assignments_reviewer_read on public.vessel_assignments;
create policy vessel_assignments_reviewer_read on public.vessel_assignments for select to authenticated
using (is_active or public.is_admin());

drop policy if exists vessel_assignments_select on public.vessel_assignments;
create policy vessel_assignments_select on public.vessel_assignments for select to authenticated
using (
  public.is_admin()
  or (
    is_active
    and public.can_access_vessel(vessel_id)
  )
);

drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders for select to authenticated
using (
  public.is_admin()
  or (
    public.current_role() = 'Captain'
    and public.can_access_vessel(vessel_id)
  )
  or (
    public.current_role() = 'Crew'
    and assigned_crew_id = public.current_profile_id()
  )
);

drop policy if exists work_order_rejections_select on public.work_order_rejections;
create policy work_order_rejections_select on public.work_order_rejections for select to authenticated
using (
  exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_rejections.work_order_id
      and (
        public.is_admin()
        or (public.current_role() = 'Captain' and public.can_access_vessel(wo.vessel_id))
        or (public.current_role() = 'Crew' and wo.assigned_crew_id = public.current_profile_id())
      )
  )
);

drop policy if exists work_order_events_select on public.work_order_events;
create policy work_order_events_select on public.work_order_events for select to authenticated
using (
  exists (
    select 1 from public.work_orders wo
    where wo.id = work_order_events.work_order_id
      and (
        public.is_admin()
        or (public.current_role() = 'Captain' and public.can_access_vessel(wo.vessel_id))
        or (public.current_role() = 'Crew' and wo.assigned_crew_id = public.current_profile_id())
      )
  )
);

drop policy if exists mock_sessions_select on public.mock_sessions;
create policy mock_sessions_select on public.mock_sessions for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists mock_sessions_insert on public.mock_sessions;
create policy mock_sessions_insert on public.mock_sessions for insert to authenticated
with check (auth_user_id = auth.uid());

drop policy if exists mock_sessions_update on public.mock_sessions;
create policy mock_sessions_update on public.mock_sessions for update to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- RPC: switch mock session
create or replace function public.switch_mock_session(
  p_profile_id uuid,
  p_vessel_id uuid default null
)
returns public.mock_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_session public.mock_sessions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id and is_active;
  if not found then
    raise exception 'Profile not found or inactive';
  end if;

  if v_profile.role <> 'Admin' and p_vessel_id is not null then
    if not public.profile_assigned_to_vessel(p_profile_id, p_vessel_id) then
      raise exception 'Profile is not assigned to the selected vessel';
    end if;
  end if;

  insert into public.mock_sessions (auth_user_id, active_profile_id, active_vessel_id)
  values (auth.uid(), p_profile_id, p_vessel_id)
  on conflict (auth_user_id) do update
    set active_profile_id = excluded.active_profile_id,
        active_vessel_id = excluded.active_vessel_id,
        updated_at = now()
  returning * into v_session;

  return v_session;
end;
$$;

grant execute on function public.switch_mock_session(uuid, uuid) to authenticated;

-- Admin RPCs
create or replace function public.admin_upsert_profile(
  p_email text,
  p_full_name text,
  p_role public.user_role,
  p_id uuid default null,
  p_is_active boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_id is null then
    insert into public.profiles (email, full_name, role, is_active)
    values (trim(p_email), trim(p_full_name), p_role, p_is_active)
    returning * into v_row;
  else
    update public.profiles
    set email = trim(p_email),
        full_name = trim(p_full_name),
        role = p_role,
        is_active = p_is_active
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'Profile not found';
    end if;
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'Duplicate user email';
end;
$$;

grant execute on function public.admin_upsert_profile(text, text, public.user_role, uuid, boolean) to authenticated;

create or replace function public.admin_deactivate_profile(p_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
  v_open_count int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select count(*) into v_open_count
  from public.work_orders wo
  where wo.assigned_crew_id = p_id
    and wo.is_closed = false;

  if v_open_count > 0 then
    raise exception 'Cannot deactivate: user has active work orders assigned';
  end if;

  if exists (
    select 1
    from public.vessel_assignments va
    join public.profiles p on p.id = va.profile_id
    where va.profile_id = p_id
      and va.is_active
      and p.role = 'Captain'
      and p.is_active
      and not exists (
        select 1
        from public.vessel_assignments va2
        join public.profiles p2 on p2.id = va2.profile_id
        where va2.vessel_id = va.vessel_id
          and va2.is_active
          and p2.role = 'Captain'
          and p2.is_active
          and p2.id <> p_id
      )
  ) then
    raise exception 'Cannot deactivate: would leave a vessel without another active Captain';
  end if;

  update public.profiles set is_active = false where id = p_id returning * into v_row;
  if not found then
    raise exception 'Profile not found';
  end if;

  update public.vessel_assignments set is_active = false where profile_id = p_id;

  return v_row;
end;
$$;

grant execute on function public.admin_deactivate_profile(uuid) to authenticated;

create or replace function public.admin_upsert_vessel(
  p_name text,
  p_id uuid default null,
  p_imo_number text default null,
  p_is_active boolean default true
)
returns public.vessels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vessels;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_id is null then
    insert into public.vessels (name, imo_number, is_active)
    values (trim(p_name), nullif(trim(p_imo_number), ''), p_is_active)
    returning * into v_row;
  else
    update public.vessels
    set name = trim(p_name),
        imo_number = nullif(trim(p_imo_number), ''),
        is_active = p_is_active
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'Duplicate vessel name or IMO number';
end;
$$;

grant execute on function public.admin_upsert_vessel(text, uuid, text, boolean) to authenticated;

create or replace function public.admin_upsert_assignment(
  p_profile_id uuid,
  p_vessel_id uuid,
  p_id uuid default null,
  p_is_active boolean default true
)
returns public.vessel_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_row public.vessel_assignments;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id;
  if not found or not v_profile.is_active then
    raise exception 'Invalid or inactive profile';
  end if;

  if v_profile.role = 'Admin' then
    raise exception 'Admins are not assigned to vessels';
  end if;

  if p_id is null then
    insert into public.vessel_assignments (profile_id, vessel_id, is_active)
    values (p_profile_id, p_vessel_id, p_is_active)
    returning * into v_row;
  else
    update public.vessel_assignments
    set profile_id = p_profile_id,
        vessel_id = p_vessel_id,
        is_active = p_is_active
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'Assignment already exists';
end;
$$;

grant execute on function public.admin_upsert_assignment(uuid, uuid, uuid, boolean) to authenticated;

create or replace function public.admin_remove_assignment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.vessel_assignments;
  v_open_count int;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_assignment from public.vessel_assignments where id = p_id;
  if not found then
    raise exception 'Assignment not found';
  end if;

  select count(*) into v_open_count
  from public.work_orders wo
  where wo.vessel_id = v_assignment.vessel_id
    and wo.assigned_crew_id = v_assignment.profile_id
    and wo.is_closed = false;

  if v_open_count > 0 then
    raise exception 'Cannot remove assignment: active work orders exist for this user on the vessel';
  end if;

  update public.vessel_assignments set is_active = false where id = p_id;
end;
$$;

grant execute on function public.admin_remove_assignment(uuid) to authenticated;

-- Work order RPCs
create or replace function public.create_work_order(
  p_title text,
  p_issue text,
  p_vessel_id uuid,
  p_assigned_crew_id uuid
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_orders;
  v_crew public.profiles;
begin
  if public.current_role() <> 'Captain' and not public.is_admin() then
    raise exception 'Only Captains can create work orders';
  end if;

  if not public.can_access_vessel(p_vessel_id) then
    raise exception 'No access to vessel';
  end if;

  select * into v_crew from public.profiles
  where id = p_assigned_crew_id and is_active and role = 'Crew';
  if not found then
    raise exception 'Assigned crew member invalid';
  end if;

  if not public.profile_assigned_to_vessel(p_assigned_crew_id, p_vessel_id) then
    raise exception 'Crew member is not assigned to this vessel';
  end if;

  insert into public.work_orders (
    title, issue, vessel_id, assigned_crew_id, created_by_id, status
  )
  values (
    trim(p_title), trim(p_issue), p_vessel_id, p_assigned_crew_id, public.current_profile_id(), 'Open'
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_work_order(text, text, uuid, uuid) to authenticated;

create or replace function public.crew_update_work_order(
  p_work_order_id uuid,
  p_status public.work_order_status,
  p_solution text default null
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_orders;
begin
  select * into v_row from public.work_orders where id = p_work_order_id for update;
  if not found then
    raise exception 'Work order not found';
  end if;

  if v_row.is_closed then
    raise exception 'Work order is closed';
  end if;

  if public.current_role() <> 'Crew' or v_row.assigned_crew_id <> public.current_profile_id() then
    raise exception 'Not authorized';
  end if;

  if p_status = 'In Progress' and v_row.status = 'Open' then
    update public.work_orders set status = 'In Progress' where id = p_work_order_id returning * into v_row;
    insert into public.work_order_events (work_order_id, actor_id, event_type)
    values (p_work_order_id, public.current_profile_id(), 'started');
  elsif p_status = 'Done' then
    if v_row.status not in ('In Progress', 'Open') then
      raise exception 'Invalid status transition';
    end if;
    if p_solution is null or length(trim(p_solution)) = 0 then
      raise exception 'Solution is required to mark Done';
    end if;
    update public.work_orders
    set status = 'Done', solution = trim(p_solution)
    where id = p_work_order_id
    returning * into v_row;
    insert into public.work_order_events (work_order_id, actor_id, event_type, note)
    values (p_work_order_id, public.current_profile_id(), 'completed', trim(p_solution));
  else
    raise exception 'Invalid status transition for crew';
  end if;

  return v_row;
end;
$$;

grant execute on function public.crew_update_work_order(uuid, public.work_order_status, text) to authenticated;

create or replace function public.captain_attest_work_order(p_work_order_id uuid)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_orders;
begin
  select * into v_row from public.work_orders where id = p_work_order_id for update;
  if not found then
    raise exception 'Work order not found';
  end if;

  if public.current_role() <> 'Captain' and not public.is_admin() then
    raise exception 'Captain only';
  end if;

  if not public.can_access_vessel(v_row.vessel_id) then
    raise exception 'No access to vessel';
  end if;

  if v_row.status <> 'Done' or v_row.is_closed then
    raise exception 'Work order must be Done and not closed';
  end if;

  update public.work_orders
  set is_closed = true,
      attested_at = now(),
      attested_by_id = public.current_profile_id()
  where id = p_work_order_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.captain_attest_work_order(uuid) to authenticated;

create or replace function public.captain_reject_work_order(
  p_work_order_id uuid,
  p_reason text
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.work_orders;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Rejection reason is required';
  end if;

  select * into v_row from public.work_orders where id = p_work_order_id for update;
  if not found then
    raise exception 'Work order not found';
  end if;

  if public.current_role() <> 'Captain' and not public.is_admin() then
    raise exception 'Captain only';
  end if;

  if not public.can_access_vessel(v_row.vessel_id) then
    raise exception 'No access to vessel';
  end if;

  if v_row.status <> 'Done' or v_row.is_closed then
    raise exception 'Only completed work orders can be rejected';
  end if;

  insert into public.work_order_rejections (work_order_id, rejected_by_id, reason)
  values (p_work_order_id, public.current_profile_id(), trim(p_reason));

  update public.work_orders
  set status = 'In Progress',
      attested_at = null,
      attested_by_id = null
  where id = p_work_order_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.captain_reject_work_order(uuid, text) to authenticated;
