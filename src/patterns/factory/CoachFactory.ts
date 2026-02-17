export interface CoachPrompt {
    systemInstruction: string;
    userPrompt: string;
}

/**
 * Interface for the Product (WorkoutCoach)
 * Definiert die Struktur für spezialisierte Coaches.
 */
export interface WorkoutCoach {
    getAnalysisPrompt(workoutData: any, profile: any, previousComparison: any): CoachPrompt;
}

/**
 * Concrete Product A: AnalyticCoach
 * Fokus auf Daten, Volumen und Fakten.
 */
export class AnalyticCoach implements WorkoutCoach {
    getAnalysisPrompt(workoutData: any, profile: any, previousComparison: any): CoachPrompt {
        const workoutSummary = this.formatSummary(workoutData);

        return {
            systemInstruction: "You are a data-driven fitness coach. Use only facts and numbers. No motivational fluff.",
            userPrompt: `
                Analyze this workout with focus on VOLUME and PROGRESSION:
                Name: ${workoutData.name}
                Duration: ${workoutData.durationMinutes} min
                Volume: ${workoutData.totalVolume}kg
                Sets: ${workoutData.completedSets}
                Summary:
                ${workoutSummary}
                
                ${previousComparison ? `Comparison: ${previousComparison.volumeChangePercent}% volume change` : 'Baseline session.'}
                User Goal: ${profile?.primary_goal}
            `
        };
    }

    private formatSummary(data: any) {
        return data.exercises.map((ex: any) => {
            const completed = ex.sets.filter((s: any) => s.is_completed);
            if (completed.length === 0) return null;
            const volume = completed.reduce((sum: number, s: any) => sum + (s.weight_kg * s.reps), 0);
            return `${ex.name}: ${completed.length} sets, ${volume}kg volume`;
        }).filter(Boolean).join('\n');
    }
}

/**
 * Concrete Product B: MotivationalCoach
 * Fokus auf Ermutigung, Kontinuität und Erreichung von Zielen.
 */
export class MotivationalCoach implements WorkoutCoach {
    getAnalysisPrompt(workoutData: any, profile: any, previousComparison: any): CoachPrompt {
        return {
            systemInstruction: "You are an encouraging and high-energy fitness coach. Focus on the positive effort and consistency.",
            userPrompt: `
                Give an encouraging analysis of this workout:
                Name: ${workoutData.name}
                Duration: ${workoutData.durationMinutes} min
                Total Effort: ${workoutData.completedSets} sets completed!
                
                User Goal: ${profile?.primary_goal}
                Make them feel great about their consistency, even if the numbers are baseline.
                Focus on the fact that they showed up and put in the work.
            `
        };
    }
}

/**
 * The Factory (Creator)
 * Bietet eine Schnittstelle für die Erstellung von Objekten.
 */
export class CoachFactory {
    static createCoach(type: 'analytic' | 'motivational'): WorkoutCoach {
        switch (type) {
            case 'analytic':
                return new AnalyticCoach();
            case 'motivational':
                return new MotivationalCoach();
            default:
                return new AnalyticCoach();
        }
    }
}
