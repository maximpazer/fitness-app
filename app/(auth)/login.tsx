import { useAuth } from '@/hooks/useAuth'
import { Link, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { signIn } = useAuth()

    const handleLogin = async () => {
        console.log("Login button pressed");
        if (!email || !password) {
            console.log("Validation failed: missing fields");
            Alert.alert('Error', 'Please fill in all fields')
            return
        }

        console.log("Attempting login with:", email);
        setLoading(true)
        try {
            const { error } = await signIn(email, password)
            console.log("Login response:", error ? "Error" : "Success", error);

            if (error) {
                Alert.alert('Login Failed', error.message)
            } else {
                // Navigation is handled by the auth state listener in _layout.tsx
            }
        } catch (e) {
            console.error("Login crashed:", e);
            Alert.alert("Error", "An unexpected error occurred during login.");
        } finally {
            setLoading(false)
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white dark:bg-black"
        >
            <ScrollView contentContainerClassName="flex-grow justify-center p-6">
                <View className="items-center mb-10">
                    <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Welcome Back</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-lg">Sign in to continue</Text>
                </View>

                <View className="gap-4">
                    <View>
                        <Text className="mb-2 text-gray-700 dark:text-gray-300 font-medium">Email</Text>
                        <TextInput
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl text-gray-900 dark:text-white"
                            placeholder="hello@example.com"
                            placeholderTextColor="#9ca3af"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className="mb-2 text-gray-700 dark:text-gray-300 font-medium">Password</Text>
                        <TextInput
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl text-gray-900 dark:text-white"
                            placeholder="••••••••"
                            placeholderTextColor="#9ca3af"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading}
                        className={`w-full bg-blue-600 p-4 rounded-xl items-center mt-2 ${loading ? 'opacity-70' : ''}`}
                    >
                        <Text className="text-white font-bold text-lg">{loading ? 'Logging in...' : 'Log In'}</Text>
                    </TouchableOpacity>

                    <View className="flex-row justify-center mt-4 gap-2">
                        <Text className="text-gray-500 dark:text-gray-400">Don't have an account?</Text>
                        <Link href="/(auth)/signup" asChild>
                            <TouchableOpacity>
                                <Text className="text-blue-600 font-bold">Sign Up</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
