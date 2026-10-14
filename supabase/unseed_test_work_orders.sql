-- Removes the 200 test work orders created by supabase/seed_test_work_orders.sql.
--
-- Their events and rejections are removed automatically (ON DELETE CASCADE).
-- The work_order_number_seq is not rewound, so numbers are never reused.

delete from public.work_orders
where id between '44444444-4444-4444-4444-000000000001'::uuid
             and '44444444-4444-4444-4444-000000000200'::uuid;
