import { generateGeminiContent } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { CreatePlanDTO, plannerService } from './planner.service';
import { workoutService } from './workout.service';

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
        // 1. Get user profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        const profile = profileData as any;

        // 2. Get previous workout history for comparison
        const recentHistory = await workoutService.getDetailedRecentHistory(userId, 3);
        
        // 3. Calculate current workout metrics
        const currentVolume = workoutData.exercises.reduce((total: number, ex: any) => {
            return total + ex.sets.reduce((exTotal: number, set: any) => {
                return set.is_completed ? exTotal + (set.weight_kg * set.reps) : exTotal;
            }, 0);
        }, 0);
        
        const completedSets = workoutData.exercises.reduce((total: number, ex: any) => {
            return total + ex.sets.filter((s: any) => s.is_completed).length;
        }, 0);
        
        // 4. Find comparison with similar workout from history
        let previousComparison = null;
        if (recentHistory.length > 0) {
            const lastWorkout = recentHistory[0];
            const lastVolume = lastWorkout.workout_exercises?.reduce((total: number, ex: any) => {
                return total + (ex.sets?.reduce((setTotal: number, set: any) => {
                    return setTotal + (set.weight_kg * set.reps);
                }, 0) || 0);
            }, 0) || 0;
            
            const volumeChange = currentVolume - lastVolume;
            const volumeChangePercent = lastVolume > 0 ? ((volumeChange / lastVolume) * 100).toFixed(1) : '0';
            
            previousComparison = {
                lastDate: new Date(lastWorkout.completed_at).toLocaleDateString(),
                volumeChange,
                volumeChangePercent,
                lastVolume
            };
        }

        // 5. Format workout data for analysis
        const workoutSummary = workoutData.exercises.map((ex: any) => {
            const completedSets = ex.sets.filter((s: any) => s.is_completed);
            if (completedSets.length === 0) return null;

            const totalVolume = completedSets.reduce((sum: number, s: any) => sum + (s.weight_kg * s.reps), 0);
            const avgWeight = totalVolume > 0 ? (completedSets.reduce((sum: number, s: any) => sum + s.weight_kg, 0) / completedSets.length).toFixed(1) : '0';
            
            return `${ex.name}: ${completedSets.length} sets, avg ${avgWeight}kg, ${totalVolume}kg total volume`;
        }).filter(Boolean).join('\n');

        const prompt = `
You are a data-driven fitness coach. Analyze this workout using only the provided data.

CURRENT WORKOUT:
Name: ${workoutData.name}
Duration: ${workoutData.durationMinutes} minutes  
Total Volume: ${currentVolume}kg
Completed Sets: ${completedSets}
Exercises:
${workoutSummary}

${previousComparison ? `COMPARISON TO LAST SESSION (${previousComparison.lastDate}):
Last Volume: ${previousComparison.lastVolume}kg
Volume Change: ${previousComparison.volumeChange > 0 ? '+' : ''}${previousComparison.volumeChange}kg (${previousComparison.volumeChangePercent}%)` : 'FIRST RECORDED SESSION - No comparison data available.'}

USER GOAL: ${profile?.primary_goal || 'General Fitness'}

Provide exactly 3 sections:

1) POSITIVE INSIGHT: One specific achievement from today's numbers (volume, sets, consistency, or duration)
2) COMPARISON: How today compared to previous session (if available) or note this is baseline session  
3) NEXT SESSION: One concrete recommendation with specific exercise or action

Rules:
- Be factual and data-focused
- No motivational fluff or general fitness advice
- Keep each section to 1-2 sentences max
- Use the actual numbers provided

Return ONLY valid JSON:
{
  "positive_insight": "specific data-based achievement",
  "comparison": "factual comparison or baseline note", 
  "next_session": "concrete specific recommendation"
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
                positive_insight: `Completed ${completedSets} sets with ${currentVolume}kg total volume`,
                comparison: previousComparison ? 
                    `${previousComparison.volumeChange > 0 ? 'Increased' : 'Decreased'} volume by ${Math.abs(previousComparison.volumeChange)}kg vs last session` :
                    "Baseline session recorded - future workouts will compare to this",
                next_session: "Focus on progressive overload by adding 2.5-5kg to your strongest exercise"
            };
        }
    }
};
