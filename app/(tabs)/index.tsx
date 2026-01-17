import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  return (
    <SafeAreaView className="flex-1 bg-gray-100 dark:bg-black" edges={['top']}>
      <ScrollView className="flex-1 px-4">
        <View className="py-6">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Hello, Athlete</Text>
          <Text className="text-gray-500 dark:text-gray-400 mb-6">Ready to crush your goals?</Text>

          <View className="bg-white dark:bg-gray-800 p-6 rounded-3xl mb-4 shadow-sm">
            <Text className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">Today's Focus</Text>
            <Text className="text-3xl font-bold text-blue-600">Upper Body Power</Text>
            <Text className="text-gray-400 mt-2">45 mins • Intermediate</Text>
          </View>

          <View className="flex-row justify-between mb-4">
            <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl w-[48%] shadow-sm">
              <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium">Workouts</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-1">12</Text>
            </View>
            <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl w-[48%] shadow-sm">
              <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium">Minutes</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-1">450</Text>
            </View>
          </View>

          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-2">Recent Activity</Text>
          {[1, 2, 3].map((i) => (
            <View key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl mb-3 flex-row items-center shadow-sm">
              <View className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center mr-4">
                <Text className="text-xl">💪</Text>
              </View>
              <View>
                <Text className="font-semibold text-gray-900 dark:text-white">Full Body HIIT</Text>
                <Text className="text-gray-500 text-sm">Yesterday • 30 mins</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
