import { generateGeminiContent } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { CreatePlanDTO, plannerService } from './planner.service';

export const aiService = {
    async generateWorkoutPlan(userId: string) {
        // 1. Fetch User Profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = profileData as any;
        if (!profile) throw new Error('User profile not found');

        // 2. Summarize Available Exercises (to provide context to AI without hitting token limits)
        const { data: categoryStats } = await supabase
            .from('exercises')
            .select('category, muscle_groups');

        const categories = [...new Set((categoryStats as any[])?.map(e => e.category))].join(', ');
        const muscles = [...new Set((categoryStats as any[])?.flatMap(e => e.muscle_groups))].join(', ');

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
    
    IMPORTANT: You have access to over 3,000 exercises across these categories: ${categories}.
    Focus on these muscle groups: ${muscles}.
    Return a balanced plan. If you name an exercise, make sure it's a standard exercise.
    `;

        // 4. Call AI
        const responseText = await generateGeminiContent(
            [{ role: 'user', parts: [{ text: prompt }] }],
            "You are a JSON-only response bot. Do not use markdown blocks."
        );

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
        // Fetch only the exercises that the AI suggested to reduce data transfer
        const suggestedNames = planData.days.flatMap((d: any) => d.exercises.map((e: any) => e.exercise_name));
        const { data: matchedExercises } = await supabase
            .from('exercises')
            .select('*')
            .in('name', suggestedNames);

        const mappedDays = planData.days.map((day: any) => ({
            ...day,
            exercises: day.exercises.map((ex: any) => {
                const foundEx = (matchedExercises as any[])?.find(e => e.name.toLowerCase() === ex.exercise_name.toLowerCase())
                    || (matchedExercises as any[])?.find(e => e.name.toLowerCase().includes(ex.exercise_name.toLowerCase()));

                if (!foundEx) return null;

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
    },

    async getActivePlan(userId: string) {
        return plannerService.getActivePlan(userId);
    },

    async analyzeWorkout(userId: string, workoutData: any) {
        // 1. Fetch User Profile for context
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = profileData as any;

        // 2. Format workout data for the prompt, including advanced metadata
        const workoutSummary = workoutData.exercises.map((ex: any) => {
            const completedSets = ex.sets.filter((s: any) => s.is_completed || s.completed);
            if (completedSets.length === 0) return null;

            const setsStr = completedSets.map((s: any, i: number) =>
                `Set ${i + 1}: ${s.weight_kg || s.weight}kg x ${s.reps} reps`
            ).join(', ');

            // Include metadata if available (joined or attached to exercise object)
            const meta = ex.exercise ? ` [Type: ${ex.exercise.classification}, Mechanics: ${ex.exercise.mechanics}, Movement: ${ex.exercise.movement_type}]` : '';

            return `${ex.name || 'Exercise'}${meta}: ${setsStr}`;
        }).filter(Boolean).join('\n');

        const prompt = `
        You are an expert fitness coach. Analyze the following completed workout and provide constructive, motivating feedback.
        
        User Profile:
        - Goal: ${profile?.primary_goal || 'Fitness'}
        - Fitness Level: ${profile?.fitness_level || 'Intermediate'}
        
        Workout Session:
        - Name: ${workoutData.name}
        - Duration: ${workoutData.durationMinutes} minutes
        - Exercises Completed:
        ${workoutSummary}
        
        Provide your analysis in a clear, encouraging tone. 
        Focus on:
        1. "The Good": What they did well (volume, consistency, session duration).
        2. "To Improve": Specific suggestions for next time (reps, rest, or variety based on their goal).
        3. "Coach's Tip": A small, actionable piece of advice.
        
        Return ONLY valid JSON (no markdown) with this EXACT structure:
        {
          "summary": "One sentence overall summary",
          "the_good": ["point 1", "point 2"],
          "to_improve": ["point 1"],
          "coach_tip": "Specific actionable tip"
        }
        `;

        const responseText = await generateGeminiContent(
            [{ role: 'user', parts: [{ text: prompt }] }],
            "You are a JSON-only response bot. Do not use markdown blocks."
        );

        try {
            const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (e) {
            console.error("AI returned invalid JSON for analysis:", responseText);
            return {
                summary: "Great job completing your workout!",
                the_good: ["You showed up and put in the work.", "Consistency is key to results."],
                to_improve: ["Keep pushing yourself in future sessions."],
                coach_tip: "Make sure to stay hydrated and prioritize recovery today."
            };
        }
    }
};
