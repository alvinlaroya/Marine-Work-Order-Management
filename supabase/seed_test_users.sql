-- Test seed: 250 users (profiles) for load / pagination / UI testing.
--
-- Kept separate from seed.sql so the demo data stays small. Run AFTER schema.sql
-- (and preferably after seed.sql so vessels exist to assign people to).
--
-- Distribution (250 total):
--   #001-#010  Admin    (10)
--   #011-#050  Captain  (40)
--   #051-#250  Crew     (200)
--
-- Captains and Crew are also assigned to existing active vessels round-robin
-- (skipped automatically if there are no vessels). Admins are never assigned
-- to vessels, matching the admin_assign_vessel rule.
--
-- Idempotent: IDs are deterministic (33333333-3333-3333-3333-0000000000NN) and
-- emails are unique, so re-running will not create duplicates.
-- Remove everything with supabase/unseed_test_users.sql.

with first_names as (
  select array[
    'Liam','Noah','Oliver','Elijah','James','William','Benjamin','Lucas','Henry','Theodore',
    'Olivia','Emma','Charlotte','Amelia','Sophia','Isabella','Mia','Evelyn','Harper','Luna',
    'Mateo','Leo','Daniel','Jack','Owen','Ava','Ella','Aria','Chloe','Nora'
  ] as names
),
last_names as (
  select array[
    'Anderson','Bennett','Carter','Davis','Edwards','Foster','Garcia','Hughes','Ibrahim','Jensen',
    'Kim','Lopez','Morgan','Nguyen','Ortiz','Patel','Quinn','Reyes','Santos','Turner',
    'Underwood','Vargas','Walker','Xu','Young','Zhang','Murray','Fisher','Rowe','Hale'
  ] as names
),
gen as (
  select
    n,
    ('33333333-3333-3333-3333-' || lpad(n::text, 12, '0'))::uuid as id,
    'test.user' || lpad(n::text, 3, '0') || '@fleet.test' as email,
    fn.names[1 + ((n - 1) % array_length(fn.names, 1))]
      || ' '
      || ln.names[1 + (((n - 1) / array_length(fn.names, 1) + (n - 1)) % array_length(ln.names, 1))]
      as full_name,
    case
      when n <= 10 then 'Admin'
      when n <= 50 then 'Captain'
      else 'Crew'
    end::public.user_role as role
  from generate_series(1, 250) as n
  cross join first_names fn
  cross join last_names ln
)
insert into public.profiles (id, email, full_name, role, is_active)
select id, email, full_name, role, true
from gen
on conflict do nothing;

-- Round-robin vessel assignments for the Captain / Crew test users.
with vessel_list as (
  select id, row_number() over (order by name, id) as rn
  from public.vessels
  where is_active
),
vessel_count as (
  select count(*)::int as c from vessel_list
),
test_staff as (
  select id, row_number() over (order by email) as rn
  from public.profiles
  where id between '33333333-3333-3333-3333-000000000001'::uuid
                and '33333333-3333-3333-3333-000000000250'::uuid
    and role in ('Captain', 'Crew')
)
insert into public.vessel_assignments (profile_id, vessel_id, is_active)
select s.id, v.id, true
from test_staff s
cross join vessel_count vc
join vessel_list v on v.rn = 1 + ((s.rn - 1) % vc.c)
where vc.c > 0
on conflict (profile_id, vessel_id) do nothing;
