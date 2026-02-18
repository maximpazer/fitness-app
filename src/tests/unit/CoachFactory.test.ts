import { AnalyticCoach, CoachFactory, MotivationalCoach } from '../../patterns/factory/CoachFactory';

describe('Unit Test: CoachFactory (Factory Pattern)', () => {
    // Test 1: Factory creates correct AnalyticCoach
    it('should create an AnalyticCoach when type is "analytic"', () => {
        const coach = CoachFactory.createCoach('analytic');
        expect(coach).toBeInstanceOf(AnalyticCoach);
    });

    // Test 2: Factory creates correct MotivationalCoach
    it('should create a MotivationalCoach when type is "motivational"', () => {
        const coach = CoachFactory.createCoach('motivational');
        expect(coach).toBeInstanceOf(MotivationalCoach);
    });

    // Test 3: AnalyticCoach generates correct prompt structure
    it('AnalyticCoach should generate a data-focused prompt', () => {
        const coach = new AnalyticCoach();
        const { systemInstruction } = coach.getAnalysisPrompt({}, {}, {});
        expect(systemInstruction).toContain('data-driven analyst');
        expect(systemInstruction).toContain('trends, volume, and progressive overload');
    });

    // Test 4: MotivationalCoach generates correct prompt structure
    it('MotivationalCoach should generate a supportive prompt', () => {
        const coach = new MotivationalCoach();
        const { systemInstruction } = coach.getAnalysisPrompt({}, {}, {});
        expect(systemInstruction).toContain('high-energy, supportive coach');
        expect(systemInstruction).toContain('celebrate consistency');
    });
});
