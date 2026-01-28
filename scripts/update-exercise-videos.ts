/**
 * Update existing exercises with video data from matching ExerciseDB entries
 * 
 * Run: npx ts-node --esm scripts/update-exercise-videos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Manual mapping of your exercises to ExerciseDB exercises with videos
const exerciseMapping: Record<string, string> = {
  'Barbell Bench Press': 'Bench Press',
  'Dumbbell Bench Press': 'Bench Press',
  'Incline Dumbbell Press': 'Palms In Incline Bench Press',
  'Push-ups': 'Diamond Push-up',
  'Barbell Row': 'One Arm Bent-over Row',
  'Dumbbell Row': 'Dumbbell One Arm Bent-over Row',
  'Lat Pulldown': 'Pull-up',
  'Pull-ups': 'Pull-up',
  'Chin-ups': 'Chin-Up',
  'Deadlift': 'Romanian Deadlift',
  'Barbell Squat': 'Squat',
  'Walking Lunges': 'Walking Lunge',
  'Calf Raises': 'Standing Calf Raise',
  'Overhead Press': 'Seated Shoulder Press',
  'Dumbbell Shoulder Press': 'Seated Shoulder Press',
  'Lateral Raises': 'Lateral Raise',
  'Barbell Curl': 'Hammer Curl',
  'Hammer Curls': 'Hammer Curl',
  'Tricep Dips': 'Triceps Dip',
  'Plank': 'Front Plank',
  'Crunches': 'Crunch Floor',
  'Hip Thrust': 'Bodyweight Single Leg Deadlift',
};

async function updateExerciseVideos() {
  console.log('🎬 Updating existing exercises with video data...\n');
  
  let updated = 0;
  let notFound = 0;
  
  for (const [oldName, newName] of Object.entries(exerciseMapping)) {
    // Get video data from the ExerciseDB entry
    const { data: source } = await supabase
      .from('exercises')
      .select('video_url, image_url, gif_url, instructions, tips')
      .eq('name', newName)
      .single();
    
    if (!source || !source.video_url) {
      console.log(`   ⚠️ No video found for: ${newName}`);
      notFound++;
      continue;
    }
    
    // Update the old exercise with video data
    const { error } = await supabase
      .from('exercises')
      .update({
        video_url: source.video_url,
        image_url: source.image_url,
        gif_url: source.gif_url,
        instructions: source.instructions,
        tips: source.tips,
      })
      .eq('name', oldName);
    
    if (error) {
      console.log(`   ❌ Failed to update ${oldName}: ${error.message}`);
    } else {
      console.log(`   ✅ Updated: ${oldName} → ${newName}`);
      updated++;
    }
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Update complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log('═══════════════════════════════════════\n');
}

updateExerciseVideos().catch(console.error);
