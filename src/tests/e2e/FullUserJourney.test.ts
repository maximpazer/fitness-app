import { GeminiAIFactory } from '../../patterns/abstract-factory/AIFactory';
import { CoachFactory } from '../../patterns/factory/CoachFactory';

describe('E2E Test: Full User Journey (Simulated)', () => {
    // Scenario: User Logs In -> Creates Plan -> Logs Workout -> Gets Analysis
    it('should allow a user to complete the core loop', async () => {
        // Step 1: "Login" (Simulated state)
        const userId = 'user_e2e_123';
        expect(userId).toBeDefined();

        // Step 2: Create Plan (using Abstract Factory for Plan Generator)
        const aiFactory = new GeminiAIFactory();
        const planGenerator = aiFactory.createPlanGenerator();
        const plan = await planGenerator.generate(userId, 'Build Muscle');

        expect(plan).toBeDefined();

        // Step 3: Log Workout (Simulated data entry)
        const workoutLog = {
            planId: 'plan_1',
            date: new Date().toISOString(),
            volume: 10000
        };
        expect(workoutLog.volume).toBeGreaterThan(0);

        // Step 4: Get Analysis (using Factory Method for Coach)
        // User decides they want a motivational summary after a hard workout
        const coach = CoachFactory.createCoach('motivational');
        const prompt = coach.getAnalysisPrompt(workoutLog, {}, {});

        expect(prompt.systemInstruction).toContain('encouraging');
    });
});
