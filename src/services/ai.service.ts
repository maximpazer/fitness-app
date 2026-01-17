import { generateGeminiContent } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { exerciseService } from './exercise.service';
import { CreatePlanDTO, plannerService } from './planner.service';

export const aiService = {
    async generateWorkoutPlan(userId: string) {
        // 1. Fetch User Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (!profile) throw new Error('User profile not found');

        // 2. Fetch Available Exercises (to provide context to AI)
        // Fetch a subset or names to reduce prompt size, or let AI hallucinate and we map broadly?
        // Better to fetch all names.
        const allExercises = await exerciseService.getExercises();
        const exerciseNames = allExercises.map(e => e.name).join(', ');

        // 3. Construct Prompt
        const prompt = `
    You are an expert fitness coach. Create a ${profile.training_days_per_week}-day per week workout plan for:
    
    User Profile:
    - Goal: ${profile.primary_goal}
    - Fitness Level: ${profile.fitness_level}
    - Days per week: ${profile.training_days_per_week}
    - Session duration: ${profile.session_duration_minutes || 60} minutes
    - Available equipment: ${profile.available_equipment?.join(', ') || 'Standard Gym'}
    - Avoid exercises: ${profile.exercise_dislikes || 'None'}
    
    Requirements:
    - Create a balanced split (e.g., Push/Pull/Legs or Upper/Lower)
    - Include compound and isolation exercises
    - Progressive overload friendly
    - Appropriate volume for fitness level
    - Use ONLY numeric values for target_reps_min, target_reps_max, target_sets, and rest_seconds
    - Do NOT use strings like "AMRAP" or "failure" - use actual numbers
    
    Return ONLY valid JSON (no markdown) with this EXACT structure:
    {
      "name": "Plan name",
      "description": "Brief description",
      "duration_weeks": 8,
      "days": [
        {
          "day_number": 1,
          "day_name": "Push Day",
          "day_type": "training",
          "notes": "Focus notes",
          "exercises": [
            {
              "exercise_name": "Exact Name From List",
              "target_sets": 4,
              "target_reps_min": 8,
              "target_reps_max": 12,
              "target_rpe": 8,
              "rest_seconds": 90,
              "notes": "Tips"
            }
          ]
        }
      ]
    }
    
    IMPORTANT: Use ONLY exercise names from this list where possible:
    [${exerciseNames}]
    If a crucial exercise is missing, you may suggest standard ones, but prefer the list.
    `;

        // 4. Call AI
        const responseText = await generateGeminiContent(prompt, "You are a JSON-only response bot. Do not use markdown blocks.");

        // Clean response (remove ```json ... ``` if present)
        const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        let planData: any;
        try {
            planData = JSON.parse(jsonString);
        } catch (e) {
            console.error("AI returned invalid JSON:", jsonString);
            throw new Error("Failed to generate valid plan JSON");
        }

        // 5. Map Exercise Names to IDs
        const mappedDays = planData.days.map((day: any) => ({
            ...day,
            exercises: day.exercises.map((ex: any) => {
                // Find exercise by name (fuzzy match or exact)
                // For now, simple find
                const foundEx = allExercises.find(e => e.name.toLowerCase() === ex.exercise_name.toLowerCase())
                    || allExercises.find(e => e.name.toLowerCase().includes(ex.exercise_name.toLowerCase()));

                if (!foundEx) {
                    // If not found, skip or use a default placeholder? 
                    // Or maybe we need to create a custom exercise?
                    // For MVP, if not found, let's filter it out or handle gracefully.
                    // Let's rely on finding a match, or if not, just pick the first matching category if desperate (unsafe).
                    // Better: Filter out invalid exercises.
                    return null;
                }
                return {
                    exercise_id: foundEx.id,
                    order_in_workout: day.exercises.indexOf(ex) + 1,
                    target_sets: typeof ex.target_sets === 'number' ? ex.target_sets : 3,
                    target_reps_min: typeof ex.target_reps_min === 'number' ? ex.target_reps_min : undefined,
                    target_reps_max: typeof ex.target_reps_max === 'number' ? ex.target_reps_max : undefined,
                    target_rpe: typeof ex.target_rpe === 'number' ? ex.target_rpe : undefined,
                    rest_seconds: typeof ex.rest_seconds === 'number' ? ex.rest_seconds : 90,
                    notes: ex.notes
                };
            }).filter((e: any) => e !== null)
        }));

        const finalPlanData: CreatePlanDTO = {
            name: planData.name,
            description: planData.description,
            duration_weeks: planData.duration_weeks,
            days: mappedDays
        };

        // 6. Save to DB
        return await plannerService.createPlan(userId, finalPlanData);
    }
};
