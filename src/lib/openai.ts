/**
 * OpenAI API Integration
 * 
 * Provides chat completion with function calling support.
 * Uses the same interface as gemini.ts for easy switching.
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Re-export types that match Gemini interface for compatibility
export interface ChatMessage {
    role: 'user' | 'model' | 'assistant' | 'system';
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

export interface OpenAIResponse {
    text?: string;
    functionCall?: {
        name: string;
        args: Record<string, any>;
    };
    finishReason?: string;
    error?: string;
}

// Convert Gemini-style messages to OpenAI format
function convertToOpenAIMessages(
    contents: ChatMessage[],
    systemInstruction?: string
): any[] {
    const messages: any[] = [];

    // Add system message if provided
    if (systemInstruction) {
        messages.push({
            role: 'system',
            content: systemInstruction,
        });
    }

    // Track tool call IDs for proper matching
    let toolCallCounter = 0;
    let lastToolCallId = '';

    // Convert each message
    for (const msg of contents) {
        // Handle function call from model
        const functionCallPart = msg.parts.find(p => p.functionCall);
        if (functionCallPart?.functionCall) {
            toolCallCounter++;
            lastToolCallId = `call_${toolCallCounter}`;
            messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{
                    id: lastToolCallId,
                    type: 'function',
                    function: {
                        name: functionCallPart.functionCall.name,
                        arguments: JSON.stringify(functionCallPart.functionCall.args),
                    },
                }],
            });
            continue;
        }

        // Handle function response
        const functionResponsePart = msg.parts.find(p => p.functionResponse);
        if (functionResponsePart?.functionResponse) {
            messages.push({
                role: 'tool',
                tool_call_id: lastToolCallId, // Use the ID from the previous tool call
                content: JSON.stringify(functionResponsePart.functionResponse.response),
            });
            continue;
        }

        // Handle text messages
        const textPart = msg.parts.find(p => p.text);
        if (textPart?.text) {
            messages.push({
                role: msg.role === 'model' ? 'assistant' : 'user',
                content: textPart.text,
            });
        }
    }

    return messages;
}

// Convert Gemini-style function declarations to OpenAI tools format
function convertToOpenAITools(options?: GenerateOptions): any[] | undefined {
    if (!options?.tools?.[0]?.functionDeclarations) {
        return undefined;
    }

    return options.tools[0].functionDeclarations.map(fn => ({
        type: 'function',
        function: {
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
        },
    }));
}

/**
 * Generate content using OpenAI with function calling support
 * Compatible interface with Gemini for easy switching
 */
export async function generateOpenAIContentWithTools(
    contents: ChatMessage[],
    systemInstruction?: string,
    options?: GenerateOptions
): Promise<OpenAIResponse> {
    if (!OPENAI_API_KEY) {
        console.error('[OpenAI] API Key missing - check EXPO_PUBLIC_OPENAI_API_KEY in .env');
        throw new Error('OpenAI API Key is missing. Set EXPO_PUBLIC_OPENAI_API_KEY in your environment.');
    }

    const messages = convertToOpenAIMessages(contents, systemInstruction);
    const tools = convertToOpenAITools(options);

    const body: any = {
        model: 'gpt-4o-mini', // Cost-effective model with function calling
        messages,
        temperature: 0.7,
        max_tokens: 2048, // Increased for comprehensive workout plans
        stream: false, // Disable streaming to ensure complete responses
    };

    if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = 'auto'; // Let the model decide when to use tools
    }

    const isDev = typeof __DEV__ !== 'undefined' ? (global as any).__DEV__ : false;
    if (isDev) console.log('[OpenAI] Sending request with', messages.length, 'messages');

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('[OpenAI] API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error?.message || 'Failed to fetch from OpenAI');
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
        console.error('[OpenAI] Empty response received');
        throw new Error('Empty response from OpenAI API');
    }

    let data;
    try {
        data = JSON.parse(responseText);
    } catch (parseError: any) {
        console.error('[OpenAI] Failed to parse API response:', {
            parseError: parseError.message,
            responseLength: responseText.length,
            responsePreview: responseText.substring(0, 500) + '...'
        });
        throw new Error(`OpenAI API returned malformed JSON: ${parseError.message}`);
    }

    const choice = data.choices?.[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason;

    // Check for function/tool call
    if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        try {
            const args = JSON.parse(toolCall.function.arguments || '{}');
            return {
                functionCall: {
                    name: toolCall.function.name,
                    args,
                },
                finishReason,
            };
        } catch (parseError: any) {
            console.error('[OpenAI] Failed to parse tool call arguments:', {
                functionName: toolCall.function.name,
                rawArguments: toolCall.function.arguments,
                parseError: parseError.message,
                argumentsLength: toolCall.function.arguments?.length || 0,
                argumentsPreview: toolCall.function.arguments?.substring(0, 200) + '...'
            });

            // Try to recover by using empty args
            return {
                functionCall: {
                    name: toolCall.function.name,
                    args: {},
                },
                finishReason,
                error: `JSON parse failed: ${parseError.message}`,
            };
        }
    }

    // Return text response
    return {
        text: message?.content || 'No response generated.',
        finishReason,
    };
}

/**
 * Simple content generation without tools (for basic queries)
 */
export async function generateOpenAIContent(
    contents: ChatMessage[],
    systemInstruction?: string
): Promise<string> {
    const response = await generateOpenAIContentWithTools(contents, systemInstruction);
    return response.text || 'No response generated.';
}
