import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Logger() {
    const [workouts, setWorkouts] = useState<{ name: string, sets: string }[]>([]);
    const [name, setName] = useState('');
    const [sets, setSets] = useState('');

    const addLog = () => {
        if (name && sets) {
            setWorkouts([{ name, sets }, ...workouts]);
            setName('');
            setSets('');
        }
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-black" edges={['top']}>
            <ScrollView className="flex-1 p-4">
                <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-6 pt-4">Logger</Text>

                <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm mb-6">
                    <Text className="text-gray-900 dark:text-white font-semibold mb-3">Log Exercise</Text>
                    <TextInput
                        placeholder="Exercise Name (e.g. Bench Press)"
                        className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-3 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
                        placeholderTextColor="#9ca3af"
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput
                        placeholder="Details (e.g. 3 sets x 10 reps @ 135lbs)"
                        className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl mb-4 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
                        placeholderTextColor="#9ca3af"
                        value={sets}
                        onChangeText={setSets}
                    />
                    <TouchableOpacity onPress={addLog} className="bg-green-600 p-4 rounded-xl items-center">
                        <Text className="text-white font-bold text-lg">Log Set</Text>
                    </TouchableOpacity>
                </View>

                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">Today's Logs</Text>

                {workouts.length === 0 ? (
                    <Text className="text-gray-500 text-center mt-4">No exercises logged today yet.</Text>
                ) : (
                    workouts.map((w, i) => (
                        <View key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl mb-3 shadow-sm border-l-4 border-green-500">
                            <Text className="text-lg font-bold text-gray-900 dark:text-white">{w.name}</Text>
                            <Text className="text-gray-600 dark:text-gray-400">{w.sets}</Text>
                        </View>
                    ))
                )}

            </ScrollView>
        </SafeAreaView>
    );
}
