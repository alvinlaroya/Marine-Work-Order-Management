-- Removes the 250 test users created by supabase/seed_test_users.sql.
--
-- Users that are referenced by work orders, rejections or events are kept
-- (those foreign keys are ON DELETE RESTRICT), so nothing else is damaged.
-- Run unseed_test_work_orders.sql first to remove them all.
--
-- Separate statements (not one CTE chain) so the child rows are really gone
-- before the RESTRICT foreign keys on the profiles are checked.

begin;

create temporary table _deletable_test_users on commit drop as
select t.id
from public.profiles t
where t.id between '33333333-3333-3333-3333-000000000001'::uuid
               and '33333333-3333-3333-3333-000000000250'::uuid
  and not exists (select 1 from public.work_orders w
                  where t.id in (w.assigned_crew_id, w.created_by_id, w.attested_by_id))
  and not exists (select 1 from public.work_order_rejections r where r.rejected_by_id = t.id)
  and not exists (select 1 from public.work_order_events e where e.actor_id = t.id);

delete from public.mock_sessions
where active_profile_id in (select id from _deletable_test_users);

delete from public.vessel_assignments
where profile_id in (select id from _deletable_test_users);

delete from public.profiles
where id in (select id from _deletable_test_users);

commit;
