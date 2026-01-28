import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env or .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CSV_PATH = path.join(process.cwd(), 'database/functional_fitness.exercises.supabase.csv');

function parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(s => s.trim());
}

async function run() {
    console.log('--- Starting Exercise Database Update ---');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV file not found at ${CSV_PATH}`);
        return;
    }

    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const headers = parseCSVLine(lines[0]);
    const dataLines = lines.slice(1);

    console.log(`Found ${dataLines.length} exercises to import.`);

    // 1. Clear existing data (in correct order for foreign keys)
    console.log('Clearing existing workout and plan data to satisfy foreign key constraints...');

    // Tables referencing exercises or workout_exercises
    const tablesToClear = ['workout_sets', 'workout_exercises', 'plan_exercises'];

    for (const table of tablesToClear) {
        console.log(`Clearing ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            console.warn(`Warning: Error clearing ${table}:`, error.message);
            // We continue anyway, as some tables might be empty
        }
    }

    console.log('Clearing existing exercises...');
    const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
        console.error('Error clearing exercises:', deleteError);
        return;
    }

    // 2. Prepare data for insert
    const exercises = dataLines.map((line, index) => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((header, i) => {
            let val: any = values[i];

            // Handle boolean strings
            if (val === 'true') val = true;
            if (val === 'false') val = false;
            if (val === '') val = null;

            // Handle Postgres array strings "{val1,val2}" -> ["val1", "val2"]
            if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
                try {
                    // Simplistic parsing of Postgres arrays for this specific CSV
                    val = val.substring(1, val.length - 1)
                        .split(',')
                        .map(item => item.replace(/^"(.*)"$/, '$1').replace(/""/g, '"'))
                        .filter(item => item !== '');
                } catch (e) {
                    console.warn(`Failed to parse array in line ${index + 2}: ${val}`);
                }
            }

            // NEW: Parse Description for "Classification · Movement · Target Muscle · Region"
            if (header === 'description' && typeof val === 'string' && val.includes(' · ')) {
                const parts = val.split(' · ');
                if (parts.length >= 3) {
                    obj.classification = parts[0].trim();
                    // Part 1 is usually movement, but we'll collect all movements
                    const descMovement = parts[1].trim();
                    obj.target_muscle = parts[2].trim();
                    if (parts.length >= 4) {
                        obj.target_region = parts[3].trim();
                    }

                    // Initialize movement patterns with the one from description
                    if (!obj.movement_patterns) obj.movement_patterns = [];
                    if (descMovement && !obj.movement_patterns.includes(descMovement)) {
                        obj.movement_patterns.push(descMovement);
                    }
                }
            }

            // Extract metadata from tags in the 'tips' column
            if (header === 'tips' && Array.isArray(val)) {
                val.forEach(tag => {
                    if (typeof tag !== 'string') return;
                    const [key, ...rest] = tag.split(':');
                    if (!rest.length) return;
                    const value = rest.join(':').trim();
                    const normalizedKey = key.trim().toLowerCase();

                    switch (normalizedKey) {
                        case 'classification':
                            // Prioritize description classification if it exists, otherwise use this
                            if (!obj.classification) obj.classification = value;
                            break;
                        case 'mechanics': obj.mechanics = value; break;
                        case 'movement':
                            // Collect into array instead of overwriting
                            if (!obj.movement_patterns) obj.movement_patterns = [];
                            if (!obj.movement_patterns.includes(value)) {
                                obj.movement_patterns.push(value);
                            }
                            // Keep single column for backward compat for now, or just use first one
                            obj.movement_type = value;
                            break;
                        case 'posture': obj.posture = value; break;
                        case 'grip': obj.grip = value; break;
                        case 'load position': obj.load_position = value; break;
                        case 'laterality': obj.laterality = value; break;
                        case 'force type': obj.force_type = value; break;
                    }
                });
            }

            obj[header] = val;
        });
        return obj;
    });

    // 3. Batch insert
    const BATCH_SIZE = 500;
    console.log(`Inserting in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
        const batch = exercises.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
            .from('exercises')
            .insert(batch);

        if (insertError) {
            console.error(`Error inserting batch starting at ${i}:`, insertError);
            // Continue or break? Let's break to be safe
            break;
        }
        console.log(`Inserted ${i + batch.length}/${exercises.length}...`);
    }

    console.log('--- Database Update Complete ---');
}

run();
