import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        setLoading(false);
        if (error) Alert.alert('Error', error.message);
        else {
            // Navigate to dashboard
            router.replace('/(tabs)');
        }
    }

    const handleSignUp = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password
        });
        setLoading(false);
        if (error) Alert.alert('Error', error.message);
        else Alert.alert('Success', 'Check your email for confirmation!');
    }

    return (
        <View className="flex-1 justify-center items-center bg-white dark:bg-black p-6">
            <Text className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Fitness App</Text>

            <TextInput
                className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-4 text-gray-900 dark:text-white"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
            />
            <TextInput
                className="w-full bg-gray-100 dark:bg-gray-900 p-4 rounded-xl mb-8 text-gray-900 dark:text-white"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TouchableOpacity
                className="w-full bg-blue-600 p-4 rounded-xl items-center mb-4"
                onPress={handleLogin}
                disabled={loading}
            >
                <Text className="text-white font-bold text-lg">Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={handleSignUp}
                disabled={loading}
            >
                <Text className="text-blue-600">Create an account</Text>
            </TouchableOpacity>
        </View>
    );
}
