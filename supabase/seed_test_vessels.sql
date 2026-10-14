-- Test seed: 20 vessels for load / pagination / UI testing.
--
-- Kept separate from seed.sql so the demo data stays small. Run AFTER schema.sql.
-- Recommended order for a full test dataset:
--   schema.sql -> seed.sql -> seed_test_vessels.sql -> seed_test_users.sql -> seed_test_work_orders.sql
-- (users and work orders are spread across whatever active vessels exist when
-- they run, so seed the vessels first.)
--
-- Details:
--   * 18 active vessels and 2 inactive ones (#19, #20) to exercise inactive states.
--   * Names are unique (e.g. "MV Pacific Voyager"); IMO numbers are unique and
--     have a valid IMO check digit (7 digits, prefixed with "IMO").
--
-- Idempotent: IDs are deterministic (55555555-5555-5555-5555-0000000000NN) and
-- name / IMO are unique, so re-running will not create duplicates.
-- Remove everything with supabase/unseed_test_vessels.sql.

with names as (
  select array[
    'Pacific Voyager','Atlantic Pioneer','Nordic Aurora','Coral Princess','Silver Tide',
    'Golden Horizon','Blue Meridian','Northern Star','Southern Cross','Eastern Wind',
    'Western Spirit','Arctic Explorer','Tropic Dawn','Polar Navigator','Sea Sovereign',
    'Harbor Guardian','Iron Mariner','Crimson Wave','Emerald Current','Distant Shore'
  ] as n,
  array['MV','MT','MS','MV','MV'] as prefixes
),
gen as (
  select
    i,
    ('55555555-5555-5555-5555-' || lpad(i::text, 12, '0'))::uuid as id,
    nm.prefixes[1 + ((i - 1) % array_length(nm.prefixes, 1))] || ' ' || nm.n[i] as name,
    -- 6-digit base, then the IMO check digit: sum(digit_k * (8 - k)) mod 10.
    (940000 + i * 137)::text as base,
    i <= 18 as is_active
  from generate_series(1, 20) as i
  cross join names nm
)
insert into public.vessels (id, name, imo_number, is_active)
select
  id,
  name,
  'IMO' || base || (
    (substr(base, 1, 1)::int * 7
     + substr(base, 2, 1)::int * 6
     + substr(base, 3, 1)::int * 5
     + substr(base, 4, 1)::int * 4
     + substr(base, 5, 1)::int * 3
     + substr(base, 6, 1)::int * 2) % 10
  )::text,
  is_active
from gen
on conflict do nothing;
