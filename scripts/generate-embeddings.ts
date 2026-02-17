import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import OpenAI from 'openai';

// Initialize clients
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in .env');
    process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

interface Exercise {
    id: string;
    name: string;
    description: string;
    classification: string;
    mechanics: string;
    movement_type: string;
    target_muscle: string;
    target_region: string;
    muscle_groups: string[];
    equipment_needed: string[];
    movement_patterns: string[];
    difficulty: string;
    posture: string;
    force_type: string;
    laterality: string;
}

function createExerciseDescription(exercise: any): string {
    const parts = [
        exercise.name,
        exercise.name, // Weight name higher
        exercise.description,
        exercise.classification,
        exercise.mechanics,
        exercise.movement_type,
        exercise.target_muscle,
        exercise.target_region,
        exercise.muscle_groups?.join(' '),
        exercise.equipment_needed?.join(' '),
        exercise.movement_patterns?.join(' '),
        exercise.difficulty,
        exercise.posture,
        exercise.force_type,
        exercise.laterality,
    ].filter(Boolean);

    let text = parts.join(' · ');

    // Add semantic keywords
    if (exercise.equipment_needed?.includes('Bodyweight')) {
        text += ' · calisthenics bodyweight no equipment';
    }
    if (exercise.equipment_needed?.includes('Barbell')) {
        text += ' · barbell free weight strength training';
    }
    if (exercise.equipment_needed?.includes('Dumbbell')) {
        text += ' · dumbbell free weight unilateral';
    }
    if (exercise.mechanics === 'Compound') {
        text += ' · compound movement multi-joint functional';
    }
    if (exercise.mechanics === 'Isolation') {
        text += ' · isolation single-joint accessory';
    }
    if (exercise.classification === 'Powerlifting') {
        text += ' · powerlifting strength heavy load';
    }
    if (exercise.classification === 'Bodybuilding') {
        text += ' · bodybuilding hypertrophy muscle building';
    }
    if (exercise.classification === 'Postural') {
        text += ' · core stability anti-movement control';
    }

    return text;
}

async function getAllExercises() {
    let allExercises: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    console.log('📥 Fetching exercises from Supabase...');

    while (hasMore) {
        const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
            allExercises = [...allExercises, ...data];
            console.log(`   - Fetched ${data.length} exercises (Total: ${allExercises.length})`);

            if (data.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }
    return allExercises;
}

async function generateEmbeddings() {
    console.log('🚀 Starting embedding generation...');

    try {
        const exercises = await getAllExercises();

        if (!exercises || exercises.length === 0) {
            console.log('⚠️ No exercises found.');
            return;
        }

        console.log(`📊 Found ${exercises.length} exercises to process.`);

        const BATCH_SIZE = 100;
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
            const batch = exercises.slice(i, i + BATCH_SIZE);
            console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(exercises.length / BATCH_SIZE)} (${batch.length} exercises)...`);

            try {
                // Generate descriptions
                const inputs = batch.map(exercise => createExerciseDescription(exercise));

                // Call OpenAI API
                const response = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: inputs,
                });

                // Update Supabase
                const updates = batch.map((exercise, index) => ({
                    id: exercise.id,
                    embedding: response.data[index].embedding,
                }));

                // Update sequentially to be safe
                await Promise.all(updates.map(update =>
                    supabase.from('exercises').update({ embedding: update.embedding }).eq('id', update.id)
                ));

                processedCount += batch.length;
                console.log(`✅ Batch complete.`);

            } catch (err) {
                console.error(`❌ Error processing batch:`, err);
                errorCount += batch.length;
            }

            // Rate limiting delay
            if (i + BATCH_SIZE < exercises.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const cost = (exercises.length / 1000) * 0.02;

        console.log('\n✨ Processing complete!');
        console.log(`✅ Successfully processed: ${processedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`💰 Estimated cost: ~$${cost.toFixed(4)}`);

    } catch (err) {
        console.error('❌ Fatal error:', err);
    }
}

generateEmbeddings();
