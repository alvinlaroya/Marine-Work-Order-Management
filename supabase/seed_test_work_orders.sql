-- Test seed: 200 randomised work orders for load / pagination / UI testing.
--
-- Run AFTER schema.sql, seed.sql and (ideally) seed_test_users.sql. It uses
-- whatever active Crew members are assigned to active vessels, so it works
-- with just the small demo seed too, but 200 orders look best spread across
-- the 250 test users.
--
-- For every order it randomly picks:
--   * a vessel + a Crew member actively assigned to that vessel (assignee)
--   * a Captain on the same vessel as creator (falls back to an Admin)
--   * a title / issue / solution from a pool of realistic marine jobs
--   * a status, with history that is consistent with the app's workflow:
--       30%  Open
--       25%  In Progress   (~15% of these were rejected by the Captain once)
--       15%  Done          (waiting for Captain attestation)
--       30%  Done + closed (attested by the Captain)
--     "started" / "completed" events and rejections are created to match.
--   * a created_at spread over the last ~100 days (older orders get lower
--     numbers). Work order numbers come from public.work_order_number_seq,
--     so they continue the normal WO-000123 numbering.
--
-- Idempotent: IDs are deterministic (44444444-4444-4444-4444-0000000000NN).
-- Re-running skips orders that already exist (no duplicates, no wasted
-- sequence numbers). Random choices are seeded, so a fresh DB gets the same
-- result every time.
-- Remove everything with supabase/unseed_test_work_orders.sql.

do $$
declare
  c_count constant int := 200;

  -- Parallel arrays: index N of each describes one kind of job.
  titles text[] := array[
    'Main engine vibration',
    'Generator #2 failed to start',
    'Bilge pump not auto-starting',
    'Galley freezer alarm',
    'Navigation light out',
    'Radar display flickering',
    'Steering gear hydraulic leak',
    'Fresh water pump low pressure',
    'Anchor windlass jammed',
    'Fire damper stuck closed',
    'Life raft service due',
    'Air conditioning not cooling',
    'Cargo crane limit switch fault',
    'Oily water separator alarm',
    'Engine room ventilation fan noise',
    'Emergency lighting test failure',
    'Mooring winch brake slipping',
    'Turbocharger oil leak',
    'Deck hatch seal worn',
    'GPS antenna signal loss',
    'Sewage treatment plant alarm',
    'Fuel purifier sludge buildup',
    'Battery bank voltage low',
    'Ballast valve actuator fault'
  ];
  issues text[] := array[
    'Unusual vibration on the main engine between 1100 and 1300 RPM.',
    'Generator #2 cranks but does not fire; no start air or fuel alarm shown.',
    'Bilge pump in the engine room does not start on high-level float.',
    'Freezer temperature alarm triggered overnight; contents at risk.',
    'Starboard sidelight not illuminating during evening watch.',
    'Radar picture flickers and drops out intermittently in heavy rain.',
    'Hydraulic oil weeping from the port steering ram seal.',
    'Fresh water pressure drops below 2 bar when two or more taps are open.',
    'Anchor windlass jams halfway while heaving; chain gypsy not turning.',
    'Fire damper in the galley exhaust trunk does not close on test.',
    'Annual servicing of life rafts is due within the next 30 days.',
    'Accommodation A/C blows warm air; compressor cycling on and off.',
    'Aft crane slew limit switch tripping early and halting operation.',
    'OWS 15 ppm alarm sounding during normal discharge operations.',
    'Loud bearing noise from the engine room supply fan.',
    'Several emergency lights in the accommodation passage failed the 30 minute test.',
    'Forward mooring winch brake slips under load during berthing.',
    'Oil film visible around the turbocharger casing joint after running.',
    'Weather deck hatch cover seal is cracked and admitting water.',
    'GPS position drops out for several minutes at a time.',
    'STP high-level alarm active; discharge pump not clearing the tank.',
    'Purifier needs cleaning more often than the planned interval.',
    'House battery bank reading 22.1 V at rest and dropping quickly under load.',
    'Remote ballast valve no. 3 does not respond to the control panel.'
  ];
  solutions text[] := array[
    'Re-balanced the flywheel coupling and re-torqued the engine mounts. Vibration back within limits.',
    'Bled the fuel line, replaced the clogged filter and reset the start-air solenoid. Test run OK.',
    'Cleaned and replaced the float switch; pump now starts and stops automatically.',
    'Replaced the faulty temperature sensor and recalibrated the thermostat.',
    'Replaced the failed LED unit and checked the circuit breaker and wiring.',
    'Re-seated the display cable and updated firmware; picture stable after sea trial.',
    'Replaced the ram seal kit, topped up hydraulic oil and pressure tested the system.',
    'Replaced the pressure switch and cleaned the accumulator tank pre-charge.',
    'Freed the gypsy clutch, greased the shaft and replaced the worn key.',
    'Cleaned the fusible link and replaced the damper spring. Closes on test.',
    'Life rafts landed ashore and serviced by an approved station; certificates on file.',
    'Recharged refrigerant after repairing a leaking flare joint; cooling restored.',
    'Replaced the limit switch and adjusted the cam. Crane tested under load.',
    'Replaced the 15 ppm sensor cell and recalibrated the monitor.',
    'Replaced the fan bearings and rebalanced the impeller.',
    'Replaced aged battery packs in 6 fittings; all lights pass the duration test.',
    'Relined the brake band and adjusted the spring tension. Holding to rated load.',
    'Replaced the casing gasket and re-torqued the studs. No leaks after 4 hours running.',
    'Fitted a new hatch gasket and adjusted the dogs; hose tested watertight.',
    'Replaced the antenna cable connector and sealed it. Signal stable.',
    'Cleared the discharge line, replaced the macerator pump and reset the alarm.',
    'Overhauled the purifier, replaced the discs and gaskets, adjusted feed rate.',
    'Replaced two failed cells, equalised the bank and verified the charger output.',
    'Replaced the actuator solenoid and tested the valve open/close from the panel.'
  ];
  reasons text[] := array[
    'Fix did not hold during the sea trial; the fault came back.',
    'Please attach the test record and re-check the repair under load.',
    'Solution notes are unclear; component was not fully reinstalled.',
    'Leak is still present after the repair. Needs another pass.',
    'Spare parts used do not match the approved specification.'
  ];

  i int;
  idx int;
  roll double precision;

  v_id uuid;
  v_vessel uuid;
  v_crew uuid;
  v_captain uuid;
  v_status public.work_order_status;
  v_closed boolean;
  v_rejected boolean;
  v_solution text;
  v_created timestamptz;
  v_started timestamptz;
  v_completed timestamptz;
  v_attested timestamptz;
  v_inserted int := 0;
  v_skipped int := 0;
begin
  perform setseed(0.42);

  if not exists (
    select 1
    from public.vessel_assignments va
    join public.profiles p on p.id = va.profile_id
    join public.vessels v on v.id = va.vessel_id
    where va.is_active and p.is_active and v.is_active and p.role = 'Crew'
  ) then
    raise notice 'No active Crew assigned to an active vessel. Run seed.sql / seed_test_users.sql first.';
    return;
  end if;

  for i in 1..c_count loop
    v_id := ('44444444-4444-4444-4444-' || lpad(i::text, 12, '0'))::uuid;

    -- Always draw the random values below so results stay stable across re-runs.
    idx := 1 + floor(random() * array_length(titles, 1))::int;
    roll := random();

    select va.vessel_id, va.profile_id
      into v_vessel, v_crew
    from public.vessel_assignments va
    join public.profiles p on p.id = va.profile_id
    join public.vessels v on v.id = va.vessel_id
    where va.is_active and p.is_active and v.is_active and p.role = 'Crew'
    order by random()
    limit 1;

    select p.id
      into v_captain
    from public.vessel_assignments va
    join public.profiles p on p.id = va.profile_id
    where va.vessel_id = v_vessel
      and va.is_active and p.is_active and p.role = 'Captain'
    order by random()
    limit 1;

    if v_captain is null then
      select p.id into v_captain
      from public.profiles p
      where p.is_active and p.role = 'Admin'
      order by p.email
      limit 1;
    end if;

    if v_captain is null then
      raise notice 'No active Captain or Admin found; cannot create work orders.';
      return;
    end if;

    if exists (select 1 from public.work_orders where id = v_id) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_closed := false;
    v_rejected := false;
    v_solution := null;

    if roll < 0.30 then
      v_status := 'Open';
    elsif roll < 0.55 then
      v_status := 'In Progress';
      v_rejected := random() < 0.15;
    elsif roll < 0.70 then
      v_status := 'Done';
    else
      v_status := 'Done';
      v_closed := true;
    end if;

    -- Spread over ~100 days; higher i = more recent = higher work order number.
    v_created   := now() - interval '1 day' * ((c_count - i) * 0.5 + random() * 0.4);
    v_started   := least(v_created + interval '1 hour' * (1 + random() * 10), now());
    v_completed := least(v_started + interval '1 hour' * (2 + random() * 40), now());
    v_attested  := least(v_completed + interval '1 hour' * (1 + random() * 30), now());

    if v_status = 'Done' or v_rejected then
      v_solution := solutions[idx];
    end if;

    insert into public.work_orders (
      id, work_order_number, title, issue, solution, status,
      vessel_id, assigned_crew_id, created_by_id,
      attested_at, attested_by_id, is_closed, created_at, updated_at
    )
    values (
      v_id,
      -- Empty string lets the generate_work_order_number trigger assign the next WO-xxxxxx.
      '',
      titles[idx],
      issues[idx],
      v_solution,
      v_status,
      v_vessel,
      v_crew,
      v_captain,
      case when v_closed then v_attested end,
      case when v_closed then v_captain end,
      v_closed,
      v_created,
      case
        when v_closed then v_attested
        when v_status = 'Done' or v_rejected then v_completed
        when v_status = 'In Progress' then v_started
        else v_created
      end
    );

    -- Crew activity history matching the status.
    if v_status in ('In Progress', 'Done') then
      insert into public.work_order_events (work_order_id, actor_id, event_type, created_at)
      values (v_id, v_crew, 'started', v_started);
    end if;

    if v_status = 'Done' or v_rejected then
      insert into public.work_order_events (work_order_id, actor_id, event_type, note, created_at)
      values (v_id, v_crew, 'completed', v_solution, v_completed);
    end if;

    if v_rejected then
      insert into public.work_order_rejections (work_order_id, rejected_by_id, reason, created_at)
      values (
        v_id,
        v_captain,
        reasons[1 + floor(random() * array_length(reasons, 1))::int],
        v_attested
      );
    end if;

    v_inserted := v_inserted + 1;
  end loop;

  raise notice 'Test work orders: % inserted, % already existed.', v_inserted, v_skipped;
end $$;
