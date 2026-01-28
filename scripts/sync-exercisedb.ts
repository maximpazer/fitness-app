/**
 * Sync ExerciseDB exercises to Supabase
 * 
 * Run: npx ts-node scripts/sync-exercisedb.ts
 * 
 * Prerequisites:
 * 1. Run the SQL migration to add columns to exercises table
 * 2. Set RAPIDAPI_KEY and RAPIDAPI_HOST in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env vars from both files
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// Use service role key to bypass RLS (required for inserting exercises)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const rapidApiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY!;
const rapidApiHost = process.env.EXPO_PUBLIC_RAPIDAPI_HOST!;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - using anon key (may fail due to RLS)');
  console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to .env.local from Supabase Dashboard → Settings → API\n');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_URL = 'https://exercise-db-with-videos-and-images-by-ascendapi.p.rapidapi.com/api/v1';

async function searchExercises(query: string) {
  const res = await fetch(`${BASE_URL}/exercises/search?search=${encodeURIComponent(query)}`, {
    headers: {
      'x-rapidapi-host': rapidApiHost,
      'x-rapidapi-key': rapidApiKey,
    },
  });
  return res.json();
}

async function getExerciseDetail(id: string) {
  const res = await fetch(`${BASE_URL}/exercises/${id}`, {
    headers: {
      'x-rapidapi-host': rapidApiHost,
      'x-rapidapi-key': rapidApiKey,
    },
  });
  return res.json();
}

// Search terms to cover major muscle groups
const searchTerms = [
  'chest press',
  'bench press',
  'back row',
  'lat pulldown',
  'shoulder press',
  'lateral raise',
  'squat',
  'leg press',
  'deadlift',
  'bicep curl',
  'tricep',
  'plank',
  'crunch',
  'lunge',
  'calf raise',
];

async function sync() {
  console.log('🚀 Starting ExerciseDB sync...\n');
  
  if (!rapidApiKey || !rapidApiHost) {
    console.error('❌ Missing RAPIDAPI_KEY or RAPIDAPI_HOST in .env.local');
    process.exit(1);
  }
  
  let totalAdded = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const term of searchTerms) {
    console.log(`\n🔍 Searching: "${term}"...`);
    
    try {
      const searchResult = await searchExercises(term);
      
      if (!searchResult.success || !searchResult.data) {
        console.log(`   ⚠️ No results for "${term}"`);
        continue;
      }
      
      const exercises = searchResult.data.slice(0, 10); // Limit to 10 per term
      console.log(`   Found ${exercises.length} exercises`);
      
      for (const ex of exercises) {
        // Check if already exists by exercisedb_id
        const { data: existing } = await supabase
          .from('exercises')
          .select('id, exercisedb_id')
          .eq('exercisedb_id', ex.exerciseId)
          .single();
        
        if (existing) {
          totalSkipped++;
          continue;
        }
        
        // Check if exercise with same name exists (to update it)
        const { data: existingByName } = await supabase
          .from('exercises')
          .select('id')
          .ilike('name', ex.name)
          .single();
        
        // Get full details
        const detailResult = await getExerciseDetail(ex.exerciseId);
        
        if (!detailResult.success || !detailResult.data) {
          console.log(`   ⚠️ Could not get details for ${ex.name}`);
          continue;
        }
        
        const detail = detailResult.data;
        
        // Map API body parts to valid database categories
        const mapCategory = (bodyPart: string | undefined): string => {
          if (!bodyPart) return 'full_body';
          const part = bodyPart.toLowerCase();
          
          // Map to allowed values: chest, back, shoulders, arms, legs, core, cardio, full_body
          if (part.includes('chest') || part.includes('pectoral')) return 'chest';
          if (part.includes('back') || part.includes('lat') || part.includes('trap')) return 'back';
          if (part.includes('shoulder') || part.includes('delt')) return 'shoulders';
          if (part.includes('bicep') || part.includes('tricep') || part.includes('forearm') || part.includes('arm')) return 'arms';
          if (part.includes('leg') || part.includes('quad') || part.includes('hamstring') || part.includes('glute') || part.includes('calf') || part.includes('thigh')) return 'legs';
          if (part.includes('core') || part.includes('ab') || part.includes('oblique')) return 'core';
          if (part.includes('cardio')) return 'cardio';
          
          return 'full_body';
        };
        
        const exerciseData = {
          name: detail.name,
          exercisedb_id: detail.exerciseId,
          image_url: detail.imageUrl || null,
          video_url: detail.videoUrl || null,
          gif_url: detail.gifUrl || null,
          instructions: detail.instructions || [],
          tips: detail.exerciseTips || [],
          category: mapCategory(detail.bodyParts?.[0]),
          muscle_groups: detail.targetMuscles || [],
          equipment_needed: detail.equipments || [],
        };
        
        if (existingByName) {
          // Update existing exercise with video data
          const { error } = await supabase
            .from('exercises')
            .update(exerciseData)
            .eq('id', existingByName.id);
          
          if (error) {
            console.log(`   ❌ Failed to update ${detail.name}: ${error.message}`);
          } else {
            console.log(`   📝 Updated: ${detail.name}`);
            totalUpdated++;
          }
        } else {
          // Insert new exercise
          const { error } = await supabase
            .from('exercises')
            .insert(exerciseData);
          
          if (error) {
            console.log(`   ❌ Failed to add ${detail.name}: ${error.message}`);
          } else {
            console.log(`   ✅ Added: ${detail.name}`);
            totalAdded++;
          }
        }
        
        // Rate limit: 200ms between API calls
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`   ❌ Error searching "${term}":`, err);
    }
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Sync complete!`);
  console.log(`   Added: ${totalAdded}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Skipped (already exists): ${totalSkipped}`);
  console.log('═══════════════════════════════════════\n');
}

sync().catch(console.error);
