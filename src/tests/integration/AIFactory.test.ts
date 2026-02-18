import { GeminiAIFactory, OpenAIAIFactory } from '../../patterns/abstract-factory/AIFactory';

describe('Integration Test: AIFactory (Abstract Factory Pattern)', () => {
    // Test 1: GeminiAIFactory creates a consistent family of products
    it('GeminiAIFactory should create Gemini-compatible products', () => {
        const factory = new GeminiAIFactory();
        const coach = factory.createCoach();
        const generator = factory.createPlanGenerator();

        // Check compatibility (conceptually)
        // In a real app we might check class names or instance types if exported
        expect(coach).toBeDefined();
        expect(generator).toBeDefined();
        // Simple duck typing check or class name check if possible
        expect(coach.constructor.name).toBe('GeminiCoach');
        expect(generator.constructor.name).toBe('GeminiPlanGenerator');
    });

    // Test 2: OpenAIAIFactory creates a consistent family of products
    it('OpenAIAIFactory should create OpenAI-compatible products', () => {
        const factory = new OpenAIAIFactory();
        const coach = factory.createCoach();
        const generator = factory.createPlanGenerator();

        expect(coach).toBeDefined();
        expect(generator).toBeDefined();
        expect(coach.constructor.name).toBe('OpenAICoach');
        expect(generator.constructor.name).toBe('OpenAIPlanGenerator');
    });
});
