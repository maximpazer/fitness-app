import { generateGeminiContent } from '@/lib/gemini';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Message = {
    role: 'user' | 'assistant';
    content: string;
}

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hi! I\'m your AI fitness coach. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');

        const newMessages = [...messages, { role: 'user', content: userMsg } as Message];
        setMessages(newMessages);
        setLoading(true);

        try {
            // Construct history for context
            const history = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
            const prompt = `${history}\nAssistant:`;

            const reply = await generateGeminiContent(prompt, "You are a helpful and motivating fitness coach.");
            setMessages([...newMessages, { role: 'assistant', content: reply }]);
        } catch (e) {
            setMessages([...newMessages, { role: 'assistant', content: "Sorry, I'm having trouble connecting to the server." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-black" edges={['top']}>
            <View className="flex-1">
                <View className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <Text className="text-xl font-bold text-center text-gray-900 dark:text-white">AI Coach</Text>
                </View>

                <FlatList
                    data={messages}
                    className="flex-1 px-4"
                    keyExtractor={(_, i) => i.toString()}
                    renderItem={({ item }) => (
                        <View className={`my-2 p-4 rounded-2xl max-w-[80%] ${item.role === 'user'
                            ? 'bg-blue-600 self-end rounded-tr-sm'
                            : 'bg-white dark:bg-gray-800 self-start rounded-tl-sm'
                            }`}>
                            <Text className={`${item.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                                {item.content}
                            </Text>
                        </View>
                    )}
                />

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex-row items-center">
                        <TextInput
                            className="flex-1 bg-gray-100 dark:bg-black p-4 rounded-full mr-3 text-gray-900 dark:text-white"
                            placeholder="Ask about workout, diet..."
                            placeholderTextColor="#9ca3af"
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={sendMessage}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            className="bg-blue-600 w-12 h-12 rounded-full items-center justify-center"
                            onPress={sendMessage}
                            disabled={loading}
                        >
                            <Text className="text-white text-xl">↑</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}
