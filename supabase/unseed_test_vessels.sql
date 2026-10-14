-- Removes the 20 test vessels created by supabase/seed_test_vessels.sql.
--
-- Vessels that still have work orders are kept (work_orders.vessel_id is
-- ON DELETE RESTRICT), so run unseed_test_work_orders.sql first to remove them
-- all. For the vessels that are removed, their vessel assignments are deleted
-- and any mock session pointing at them is reset to "no vessel selected".
--
-- Separate statements (not one CTE chain) so the child rows are really gone
-- before the RESTRICT foreign keys on the vessels are checked.

begin;

create temporary table _deletable_test_vessels on commit drop as
select v.id
from public.vessels v
where v.id between '55555555-5555-5555-5555-000000000001'::uuid
               and '55555555-5555-5555-5555-000000000020'::uuid
  and not exists (select 1 from public.work_orders w where w.vessel_id = v.id);

update public.mock_sessions
set active_vessel_id = null
where active_vessel_id in (select id from _deletable_test_vessels);

delete from public.vessel_assignments
where vessel_id in (select id from _deletable_test_vessels);

delete from public.vessels
where id in (select id from _deletable_test_vessels);

commit;
