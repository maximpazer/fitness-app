import { useAuthContext } from '@/context/AuthContext';
import { authService } from '@/services/auth.service';
import { profileService } from '@/services/profile.service';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { GoalsSection } from '@/components/profile/GoalsSection';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function PreferenceRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <View className="flex-row items-center justify-between">
            <Text className="text-gray-500 text-sm">{label}</Text>
            <Text className="text-white text-sm font-medium">{value || 'Not set'}</Text>
        </View>
    );
}

export default function ProfileScreen() {
    const { user, profile, loading: authLoading, signOut } = useAuthContext();
    const router = useRouter();
    const { showDialog } = useConfirmDialog();

    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (profile) {
            setDisplayName(profile.display_name || '');
            setBirthDate(profile.birth_date || '');
        }
        if (user) {
            setEmail(user.email || '');
        }
    }, [profile, user]);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Update Profile (Name, Birthday)
            const { error: profileError } = await profileService.updateProfile(user.id, {
                display_name: displayName,
                birth_date: birthDate || undefined,
            });

            if (profileError) throw profileError;

            // 2. Update Email if changed
            if (email !== user.email) {
                const { error: emailError } = await authService.updateEmail(email);
                if (emailError) throw emailError;
                showDialog('Email Update', 'A confirmation email has been sent to your new address.');
            }

            // 3. Update Password if provided
            if (newPassword) {
                if (newPassword !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (newPassword.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }
                const { error: passwordError } = await authService.updatePassword(newPassword);
                if (passwordError) throw passwordError;
                setNewPassword('');
                setConfirmPassword('');
                showDialog('Success', 'Password updated successfully');
            }

            showDialog('Success', 'Profile updated successfully');
        } catch (error: any) {
            showDialog('Update Failed', error.message || 'An error occurred while updating your profile');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        showDialog(
            'Logout',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        router.replace('/(auth)/login');
                    },
                },
            ]
        );
    };

    const handleManagePreferences = () => {
        router.push('/onboarding');
    };

    if (authLoading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-950">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                {Platform.OS === 'web' ? (
                    <View className="flex-1">
                        <ScrollView className="flex-1 px-6">
                            <View className="py-6">
                                {/* Header */}
                                <View className="flex-row items-center mb-8">
                                    <View className="w-16 h-16 bg-blue-600 rounded-full items-center justify-center mr-4">
                                        <Text className="text-white text-3xl font-bold">
                                            {displayName ? displayName[0].toUpperCase() : 'U'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="text-2xl font-bold text-white">Settings</Text>
                                        <Text className="text-gray-400">Manage your account</Text>
                                    </View>
                                </View>

                                {/* Goals Section */}
                                <GoalsSection />

                                {/* Training Preferences Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Training Preferences</Text>
                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                                        <PreferenceRow label="Goal" value={profile?.primary_goal} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Experience" value={profile?.fitness_level ? profile.fitness_level.charAt(0).toUpperCase() + profile.fitness_level.slice(1) : undefined} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Training Days" value={profile?.training_days_per_week ? `${profile.training_days_per_week} days / week` : undefined} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Equipment" value={profile?.available_equipment?.join(', ')} />
                                    </View>
                                    <TouchableOpacity
                                        className="mt-3 flex-row items-center justify-center py-3 rounded-xl border border-gray-800 bg-gray-900/50"
                                        onPress={handleManagePreferences}
                                    >
                                        <Text className="text-blue-400 font-semibold text-sm">Edit Preferences</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Personal Info Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Personal Information</Text>

                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Full Name</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="Enter your name"
                                                placeholderTextColor="#4b5563"
                                                value={displayName}
                                                onChangeText={setDisplayName}
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Email Address</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="Enter your email"
                                                placeholderTextColor="#4b5563"
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Birthday (YYYY-MM-DD)</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="1990-01-01"
                                                placeholderTextColor="#4b5563"
                                                value={birthDate}
                                                onChangeText={setBirthDate}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Security Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Security</Text>

                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">New Password</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="••••••••"
                                                placeholderTextColor="#4b5563"
                                                secureTextEntry
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Confirm New Password</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="••••••••"
                                                placeholderTextColor="#4b5563"
                                                secureTextEntry
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <TouchableOpacity
                                    className="bg-blue-600 py-4 rounded-2xl mb-4 shadow-lg shadow-blue-500/20"
                                    onPress={handleUpdateProfile}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white text-center font-bold text-lg">Save Changes</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="bg-gray-900 py-4 rounded-2xl border border-red-500/50"
                                    onPress={handleLogout}
                                >
                                    <Text className="text-red-500 text-center font-bold text-lg">Logout</Text>
                                </TouchableOpacity>

                                <View className="mt-8 items-center">
                                    <Text className="text-gray-600 text-xs">GymGenius AI v1.0.0</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                ) : (
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView className="flex-1 px-6">
                            <View className="py-6">
                                {/* Header */}
                                <View className="flex-row items-center mb-8">
                                    <View className="w-16 h-16 bg-blue-600 rounded-full items-center justify-center mr-4">
                                        <Text className="text-white text-3xl font-bold">
                                            {displayName ? displayName[0].toUpperCase() : 'U'}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text className="text-2xl font-bold text-white">Settings</Text>
                                        <Text className="text-gray-400">Manage your account</Text>
                                    </View>
                                </View>

                                {/* Goals Section */}
                                <GoalsSection />

                                {/* Training Preferences Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Training Preferences</Text>
                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                                        <PreferenceRow label="Goal" value={profile?.primary_goal} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Experience" value={profile?.fitness_level ? profile.fitness_level.charAt(0).toUpperCase() + profile.fitness_level.slice(1) : undefined} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Training Days" value={profile?.training_days_per_week ? `${profile.training_days_per_week} days / week` : undefined} />
                                        <View className="h-[1px] bg-gray-800 my-3" />
                                        <PreferenceRow label="Equipment" value={profile?.available_equipment?.join(', ')} />
                                    </View>
                                    <TouchableOpacity
                                        className="mt-3 flex-row items-center justify-center py-3 rounded-xl border border-gray-800 bg-gray-900/50"
                                        onPress={handleManagePreferences}
                                    >
                                        <Text className="text-blue-400 font-semibold text-sm">Edit Preferences</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Personal Info Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Personal Information</Text>

                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Full Name</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="Enter your name"
                                                placeholderTextColor="#4b5563"
                                                value={displayName}
                                                onChangeText={setDisplayName}
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Email Address</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="Enter your email"
                                                placeholderTextColor="#4b5563"
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Birthday (YYYY-MM-DD)</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="1990-01-01"
                                                placeholderTextColor="#4b5563"
                                                value={birthDate}
                                                onChangeText={setBirthDate}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Security Section */}
                                <View className="mb-8">
                                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Security</Text>

                                    <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">New Password</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="••••••••"
                                                placeholderTextColor="#4b5563"
                                                secureTextEntry
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                            />
                                        </View>

                                        <View className="h-[1px] bg-gray-800" />

                                        <View>
                                            <Text className="text-gray-500 mb-1 text-xs">Confirm New Password</Text>
                                            <TextInput
                                                className="text-white text-base py-1"
                                                placeholder="••••••••"
                                                placeholderTextColor="#4b5563"
                                                secureTextEntry
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <TouchableOpacity
                                    className="bg-blue-600 py-4 rounded-2xl mb-4 shadow-lg shadow-blue-500/20"
                                    onPress={handleUpdateProfile}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white text-center font-bold text-lg">Save Changes</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="bg-gray-900 py-4 rounded-2xl border border-red-500/50"
                                    onPress={handleLogout}
                                >
                                    <Text className="text-red-500 text-center font-bold text-lg">Logout</Text>
                                </TouchableOpacity>

                                <View className="mt-8 items-center">
                                    <Text className="text-gray-600 text-xs">GymGenius AI v1.0.0</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </TouchableWithoutFeedback>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
