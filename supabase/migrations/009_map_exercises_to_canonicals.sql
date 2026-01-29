-- Mapping Script: Link existing exercises to canonical exercises
-- Run this AFTER creating canonical_exercises table
-- Review and adjust mappings for your specific exercise database

-- CHEST EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'bench_press')
WHERE (name ILIKE '%bench press%' OR name ILIKE '%bench%press%')
  AND name NOT ILIKE '%incline%' 
  AND name NOT ILIKE '%decline%'
  AND name NOT ILIKE '%close grip%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'incline_press')
WHERE name ILIKE '%incline%' AND (name ILIKE '%press%' OR name ILIKE '%bench%');

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'chest_fly')
WHERE (name ILIKE '%fly%' OR name ILIKE '%flye%' OR name ILIKE '%pec deck%') AND name ILIKE '%chest%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'dip')
WHERE name ILIKE '%dip%' AND name NOT ILIKE '%pulldown%';

-- SHOULDER EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'overhead_press')
WHERE (name ILIKE '%overhead press%' OR name ILIKE '%military press%' OR name ILIKE '%shoulder press%')
  AND name NOT ILIKE '%machine%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'lateral_raise')
WHERE name ILIKE '%lateral%' AND name ILIKE '%raise%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'face_pull')
WHERE name ILIKE '%face%' AND name ILIKE '%pull%';

-- TRICEP EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'tricep_extension')
WHERE name ILIKE '%tricep%' AND (name ILIKE '%extension%' OR name ILIKE '%pushdown%');

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'close_grip_press')
WHERE name ILIKE '%close%grip%' AND name ILIKE '%press%';

-- BACK EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'deadlift')
WHERE name ILIKE '%deadlift%' 
  AND name NOT ILIKE '%romanian%'
  AND name NOT ILIKE '%single%'
  AND name NOT ILIKE '%stiff%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'row')
WHERE name ILIKE '%row%' 
  AND name NOT ILIKE '%cable%'
  AND (name ILIKE '%barbell%' OR name ILIKE '%bent%');

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'cable_row')
WHERE name ILIKE '%cable%' AND name ILIKE '%row%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'pullup')
WHERE (name ILIKE '%pull up%' OR name ILIKE '%pullup%' OR name ILIKE '%chin up%')
  AND name NOT ILIKE '%lat%'
  AND name NOT ILIKE '%machine%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'lat_pulldown')
WHERE name ILIKE '%lat%' AND name ILIKE '%pulldown%';

-- BICEP EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'bicep_curl')
WHERE name ILIKE '%curl%' 
  AND name NOT ILIKE '%hammer%'
  AND name NOT ILIKE '%preacher%'
  AND name NOT ILIKE '%leg%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'hammer_curl')
WHERE name ILIKE '%hammer%' AND name ILIKE '%curl%';

-- LEG EXERCISES (QUADS)
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'squat')
WHERE name ILIKE '%squat%' 
  AND name NOT ILIKE '%front%'
  AND name NOT ILIKE '%goblet%'
  AND name NOT ILIKE '%bulgarian%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'front_squat')
WHERE name ILIKE '%front%' AND name ILIKE '%squat%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'leg_press')
WHERE name ILIKE '%leg%' AND name ILIKE '%press%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'lunge')
WHERE name ILIKE '%lunge%' OR (name ILIKE '%split%' AND name ILIKE '%squat%');

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'leg_extension')
WHERE name ILIKE '%leg%' AND name ILIKE '%extension%';

-- LEG EXERCISES (HIPS/GLUTES)
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'romanian_deadlift')
WHERE (name ILIKE '%romanian%' OR name ILIKE '%rdl%' OR name ILIKE '%stiff%') 
  AND name ILIKE '%deadlift%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'leg_curl')
WHERE name ILIKE '%leg%' AND name ILIKE '%curl%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'hip_thrust')
WHERE name ILIKE '%hip%' AND name ILIKE '%thrust%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'calf_raise')
WHERE name ILIKE '%calf%' AND name ILIKE '%raise%';

-- CORE EXERCISES
UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'plank')
WHERE name ILIKE '%plank%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'crunch')
WHERE name ILIKE '%crunch%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'russian_twist')
WHERE name ILIKE '%russian%' AND name ILIKE '%twist%';

UPDATE public.exercises 
SET canonical_id = (SELECT id FROM public.canonical_exercises WHERE canonical_name = 'hanging_leg_raise')
WHERE name ILIKE '%hanging%' AND name ILIKE '%leg%' AND name ILIKE '%raise%';

-- Verification: Check unmapped exercises
SELECT 
  'Unmapped exercises: ' || COUNT(*)::text as status,
  COUNT(*) as count
FROM exercises 
WHERE canonical_id IS NULL;

-- Show distribution
SELECT 
  COALESCE(ce.display_name, 'UNMAPPED') as canonical_exercise,
  COUNT(e.id) as variant_count
FROM exercises e
LEFT JOIN canonical_exercises ce ON e.canonical_id = ce.id
GROUP BY ce.id, ce.display_name
ORDER BY variant_count DESC;
