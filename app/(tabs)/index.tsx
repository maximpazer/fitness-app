import { useAuthContext } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboard.service';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const dashboardData = await dashboardService.getDashboardData(user.id);
      setData(dashboardData);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 dark:bg-black">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-black" edges={['top']}>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="py-6">
          {/* Header */}
          <View className="flex-row justify-between items-start mb-6">
            <View>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white">
                Hello, {data?.displayName?.split(' ')[0] || 'Athlete'}!
              </Text>
              <Text className="text-gray-500 dark:text-gray-400 mt-1">
                {format(new Date(), 'EEEE, d MMMM')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full items-center justify-center">
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Focus Card */}
          <TouchableOpacity className="bg-blue-600 p-6 rounded-3xl mb-6 shadow-lg shadow-blue-200 dark:shadow-none">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-blue-100 font-medium mb-1">Today's Focus</Text>
                <Text className="text-3xl font-bold text-white mb-2">Upper Body Power</Text>
                <View className="flex-row items-center bg-blue-500/30 self-start px-3 py-1 rounded-full">
                  <Text className="text-white text-xs font-medium">45 mins • Intermediate</Text>
                </View>
              </View>
              <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                <Text className="text-2xl">🔥</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Stats Grid */}
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Weekly Stats</Text>
          <View className="flex-row justify-between mb-6">
            <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl w-[48%] shadow-sm">
              <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium">Workouts</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data?.weeklyCount || 0}</Text>
              <Text className="text-xs text-green-500 mt-1">This Week</Text>
            </View>
            <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl w-[48%] shadow-sm">
              <Text className="text-gray-500 dark:text-gray-400 text-sm font-medium">Minutes</Text>
              <Text className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data?.weeklyMinutes || 0}</Text>
              <Text className="text-xs text-green-500 mt-1">Active Time</Text>
            </View>
          </View>

          {/* Activity Progress Placeholder (Chart Removed) */}
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-2">Activity Progress</Text>
          <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 mb-6 shadow-sm items-center justify-center h-48">
            <Text className="text-gray-400 text-center text-lg mb-2">📊</Text>
            <Text className="text-gray-500 font-medium">Visualization Coming Soon</Text>
            <Text className="text-gray-400 text-xs mt-1 text-center px-8">Complete more workouts to unlock detailed progress charts.</Text>
          </View>

          {/* Recent Activity */}
          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent History</Text>
          {data?.recentActivity?.length > 0 ? (
            data.recentActivity.map((workout: any, i: number) => (
              <View key={i} className="bg-white dark:bg-gray-800 p-4 rounded-2xl mb-3 flex-row items-center shadow-sm">
                <View className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full items-center justify-center mr-4">
                  <Text className="text-xl">✅</Text>
                </View>
                <View>
                  <Text className="font-semibold text-gray-900 dark:text-white">{workout.workout_name || 'Workout'}</Text>
                  <Text className="text-gray-500 text-sm">
                    {format(new Date(workout.created_at), 'MMM d')} • {workout.duration_minutes} mins
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-gray-100 dark:bg-gray-900 p-6 rounded-2xl items-center">
              <Text className="text-gray-500">No workouts yet. Go start one!</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
