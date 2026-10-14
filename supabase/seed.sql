-- Demo seed data (idempotent-ish: only run on empty DB or adjust IDs)

insert into public.vessels (id, name, imo_number, is_active)
values
  ('11111111-1111-1111-1111-111111111101', 'MV Ocean Star', 'IMO9123456', true),
  ('11111111-1111-1111-1111-111111111102', 'MV Harbor Dawn', 'IMO9234567', true)
on conflict do nothing;

insert into public.profiles (id, email, full_name, role, is_active)
values
  ('22222222-2222-2222-2222-222222222201', 'admin@fleet.local', 'Alex Admin', 'Admin', true),
  ('22222222-2222-2222-2222-222222222202', 'captain.star@fleet.local', 'Sam Captain', 'Captain', true),
  ('22222222-2222-2222-2222-222222222203', 'captain.dawn@fleet.local', 'Dana Captain', 'Captain', true),
  ('22222222-2222-2222-2222-222222222204', 'crew.star1@fleet.local', 'Chris Crew', 'Crew', true),
  ('22222222-2222-2222-2222-222222222205', 'crew.star2@fleet.local', 'Taylor Crew', 'Crew', true),
  ('22222222-2222-2222-2222-222222222206', 'crew.dawn1@fleet.local', 'Jordan Crew', 'Crew', true)
on conflict do nothing;

insert into public.vessel_assignments (profile_id, vessel_id, is_active)
values
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', true),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111102', true),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', true),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111101', true),
  ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', true)
on conflict do nothing;

insert into public.work_orders (
  work_order_number, title, issue, solution, status, vessel_id, assigned_crew_id, created_by_id, is_closed
)
values
  (
    'WO-000001',
    'Engine vibration',
    'Unusual vibration on port main engine at 1200 RPM.',
    null,
    'Open',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222204',
    '22222222-2222-2222-2222-222222222202',
    false
  ),
  (
    'WO-000002',
    'Galley freezer alarm',
    'Freezer temp alarm triggered overnight.',
    'Replaced faulty sensor and recalibrated thermostat.',
    'Done',
    '11111111-1111-1111-1111-111111111102',
    '22222222-2222-2222-2222-222222222206',
    '22222222-2222-2222-2222-222222222203',
    false
  )
on conflict do nothing;

select setval('public.work_order_number_seq', 2, true);
