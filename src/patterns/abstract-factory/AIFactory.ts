import { generateGeminiContent } from '@/lib/gemini';
import { generateOpenAIContent } from '@/lib/openai';

/**
 * 1. Abstract Products
 * Diese Interfaces definieren die "Produkte", die die Fabriken erzeugen können.
 */

export interface AIAnalysisResponse {
    positive_insight: string;
    comparison: string;
    next_session: string;
}

export interface AbstractWorkoutCoach {
    analyze(workoutData: any, profile: any, comparison: any): Promise<AIAnalysisResponse>;
}

export interface AbstractPlanGenerator {
    generate(userId: string, goals: string): Promise<any>;
}

/**
 * 2. Abstract Factory (Interface)
 * Das Herzstück: Definiert Methoden zur Erstellung aller abstrakten Produkte.
 * (Punkt 3 im Diagramm)
 */
export interface AIFactory {
    createCoach(): AbstractWorkoutCoach;
    createPlanGenerator(): AbstractPlanGenerator;
}

/**
 * 3. Concrete Products (Gemini Familie)
 * (Punkt 2 im Diagramm)
 */
class GeminiCoach implements AbstractWorkoutCoach {
    async analyze(workoutData: any, profile: any, comparison: any): Promise<AIAnalysisResponse> {
        const prompt = `Analyze this workout: ${JSON.stringify(workoutData)}`;
        const response = await generateGeminiContent([{ role: 'user', parts: [{ text: prompt }] }], "You are an AI coach.");
        return JSON.parse(response); // Vereinfacht für das Muster-Beispiel
    }
}

class GeminiPlanGenerator implements AbstractPlanGenerator {
    async generate(userId: string, goals: string): Promise<any> {
        console.log(`Generating plan with Gemini for ${userId} with goals: ${goals}`);
        return { plan: 'Gemini Plan' };
    }
}

/**
 * 3. Concrete Products (OpenAI Familie)
 */
class OpenAICoach implements AbstractWorkoutCoach {
    async analyze(workoutData: any, profile: any, comparison: any): Promise<AIAnalysisResponse> {
        const response: any = await generateOpenAIContent([{ role: 'user', parts: [{ text: "Analyze workout" }] }]);
        return {
            positive_insight: typeof response === 'string' ? response : (response.text || ''),
            comparison: '',
            next_session: ''
        };
    }
}

class OpenAIPlanGenerator implements AbstractPlanGenerator {
    async generate(userId: string, goals: string): Promise<any> {
        console.log(`Generating plan with OpenAI for ${userId}`);
        return { plan: 'OpenAI Plan' };
    }
}

/**
 * 4. Concrete Factories
 * Implementieren die Erstellung der konkreten Produkte einer Familie.
 * (Punkt 4 im Diagramm)
 */
export class GeminiAIFactory implements AIFactory {
    createCoach(): AbstractWorkoutCoach {
        return new GeminiCoach();
    }
    createPlanGenerator(): AbstractPlanGenerator {
        return new GeminiPlanGenerator();
    }
}

export class OpenAIAIFactory implements AIFactory {
    createCoach(): AbstractWorkoutCoach {
        return new OpenAICoach();
    }
    createPlanGenerator(): AbstractPlanGenerator {
        return new OpenAIPlanGenerator();
    }
}

/**
 * 5. Client Logic (Beispiel)
 * (Punkt 5 im Diagramm)
 */
export class AIClient {
    private factory: AIFactory;

    constructor(factory: AIFactory) {
        this.factory = factory;
    }

    async getWorkoutAnalysis(data: any) {
        const coach = this.factory.createCoach();
        return coach.analyze(data, {}, {});
    }
}
