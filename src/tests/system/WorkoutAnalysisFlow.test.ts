import { CoachFactory } from '../../patterns/factory/CoachFactory';

// Mock dependencies (e.g., Supabase or AI Service) if needed
// For system tests, we want to test most of the logic without hitting external APIs

describe('System Test: Workout Analysis Flow', () => {
    // Scenario: User requests analysis for a workout
    it('should complete a full analysis flow for a user', async () => {
        // 1. Arrange: Prepare mock data
        const mockWorkoutData = {
            id: 'workout_123',
            name: 'Chest Day',
            totalVolume: 5000,
            durationMinutes: 60,
            completedSets: 15,
            exercises: []
        };
        const mockProfile = { name: 'Max' };
        const mockComparison = { volumeChange: 10 };

        // 2. Act: Execute the business logic through the Service/Factory layer
        // User selects "Analytic" mode
        const coach = CoachFactory.createCoach('analytic');
        const { systemInstruction, userPrompt } = coach.getAnalysisPrompt(mockWorkoutData, mockProfile, mockComparison);

        // 3. Assert: Verify the outcome
        // Ideally this would verify the AI response, but we verify the *request* construction here 
        // as the system boundary to the external AI.
        expect(systemInstruction).toBeTruthy();
        expect(userPrompt).toContain('5000'); // Volume
        expect(userPrompt).toContain('60'); // Duration (minutes)
    });
});
