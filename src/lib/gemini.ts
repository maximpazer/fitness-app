const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text?: string; functionCall?: any; functionResponse?: any }[];
}

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface GenerateOptions {
    tools?: { functionDeclarations: FunctionDeclaration[] }[];
    toolConfig?: {
        functionCallingConfig?: {
            mode: 'AUTO' | 'ANY' | 'NONE';
        };
    };
}

export interface GeminiResponse {
    text?: string;
    functionCall?: {
        name: string;
        args: Record<string, any>;
    };
    finishReason?: string;
}

export async function generateGeminiContent(
    contents: ChatMessage[],
    systemInstruction?: string,
    options?: GenerateOptions
): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API Key is missing');
    }

    const body: any = {
        contents,
    };

    if (systemInstruction) {
        body.system_instruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    if (options?.tools) {
        body.tools = options.tools;
    }

    if (options?.toolConfig) {
        body.tool_config = options.toolConfig;
    }

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error?.message || 'Failed to fetch from Gemini');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'No response generated.';
}

/**
 * Advanced Gemini content generation with function calling support
 * Returns structured response including any function calls
 */
export async function generateGeminiContentWithTools(
    contents: ChatMessage[],
    systemInstruction?: string,
    options?: GenerateOptions
): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API Key is missing');
    }

    const body: any = {
        contents,
    };

    if (systemInstruction) {
        body.system_instruction = {
            parts: [{ text: systemInstruction }]
        };
    }

    if (options?.tools) {
        body.tools = options.tools;
    }

    if (options?.toolConfig) {
        body.tool_config = options.toolConfig;
    }

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error?.message || 'Failed to fetch from Gemini');
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const finishReason = candidate?.finishReason;

    // Check for function call
    const functionCall = content?.parts?.find((p: any) => p.functionCall)?.functionCall;
    if (functionCall) {
        return {
            functionCall: {
                name: functionCall.name,
                args: functionCall.args || {},
            },
            finishReason,
        };
    }

    // Return text response
    const text = content?.parts?.find((p: any) => p.text)?.text;
    return {
        text: text || 'No response generated.',
        finishReason,
    };
}
