const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export async function generateGeminiContent(
    contents: ChatMessage[],
    systemInstruction?: string
) {
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
