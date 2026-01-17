const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function generateGeminiContent(prompt: string, systemInstruction?: string) {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API Key is missing');
    }

    // Combine system instruction with prompt if present, as the curl example is simple
    // Or usage of system_instruction field if we want to be fancy, but simple text concatenation works for the basic endpoint effectively.
    // The user provided curl structure: contents -> parts -> text.

    const finalPrompt = systemInstruction ? `${systemInstruction}\n\nUser: ${prompt}` : prompt;

    const response = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: finalPrompt,
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from Gemini');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || 'No response generated.';
}
