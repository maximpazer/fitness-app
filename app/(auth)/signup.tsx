import { useAuth } from '@/hooks/useAuth'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function Signup() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [loading, setLoading] = useState(false)

    const { signUp } = useAuth()
    const router = useRouter()
    const { showDialog } = useConfirmDialog()

    const [debugStatus, setDebugStatus] = useState('')

    const handleSignup = async () => {
        setDebugStatus('Starting validation...')
        if (!email || !password || !confirmPassword || !displayName) {
            setDebugStatus('Validation failed: Missing fields')
            showDialog('Error', 'Please fill in all fields')
            return
        }

        if (password !== confirmPassword) {
            setDebugStatus('Validation failed: Passwords mismatch')
            showDialog('Error', 'Passwords do not match')
            return
        }

        if (password.length < 6) {
            setDebugStatus('Validation failed: Password too short')
            showDialog('Error', 'Password should be at least 6 characters')
            return
        }

        console.log("Starting signup for:", email);
        setDebugStatus('Sending request to Supabase...')
        setLoading(true)

        try {
            const { data, error } = await signUp(email, password, displayName)
            setLoading(false)

            if (error) {
                console.error("Signup error:", error);
                setDebugStatus(`Error: ${error.message}`)
                showDialog('Signup Failed', error.message)
                return;
            }

            console.log("Signup success data:", data);
            setDebugStatus('Success! Checking session...')

            if (data?.session) {
                setDebugStatus('Session active. Redirecting...')
                console.log("Session created immediately. Auto-redirecting should happen.");
                // Context listener in _layout.tsx will handle redirect
            } else if (data?.user) {
                setDebugStatus('User created. Verification required.')
                console.log("User created but no session. Email verification likely required.");
                showDialog(
                    'Verification Required',
                    'Account created successfully! \n\nPlease check your email to verify your account before logging in.',
                    [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
                );
            }
        } catch (e: any) {
            console.error("Signup exception:", e);
            setLoading(false);
            setDebugStatus(`Exception: ${e.message || 'Unknown error'}`)
            showDialog('Error', 'An unexpected error occurred.')
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white dark:bg-black"
        >
            <ScrollView contentContainerClassName="flex-grow justify-center p-6">
                <View className="items-center mb-10">
                    <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Account</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-center">Join us and start your fitness journey</Text>
                </View>

                <View className="gap-4">
                    <View>
                        <Text className="mb-2 text-gray-700 dark:text-gray-300 font-medium">Display Name</Text>
                        <TextInput
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl text-gray-900 dark:text-white"
                            placeholder="John Doe"
                            placeholderTextColor="#9ca3af"
                            value={displayName}
                            onChangeText={setDisplayName}
                        />
                    </View>

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

                    <View>
                        <Text className="mb-2 text-gray-700 dark:text-gray-300 font-medium">Confirm Password</Text>
                        <TextInput
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl text-gray-900 dark:text-white"
                            placeholder="••••••••"
                            placeholderTextColor="#9ca3af"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSignup}
                        disabled={loading}
                        className={`w-full bg-blue-600 p-4 rounded-xl items-center mt-2 ${loading ? 'opacity-70' : ''}`}
                    >
                        <Text className="text-white font-bold text-lg">{loading ? 'Creating Account...' : 'Sign Up'}</Text>
                    </TouchableOpacity>

                    {/* Debug info */}
                    <Text className="text-center text-xs text-gray-500 mt-4 px-4">
                        Status: {loading ? 'Loading...' : 'Idle'}
                        {'\n'}
                        Debug: {debugStatus}
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
