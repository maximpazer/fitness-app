import { useAuthContext } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboard.service';
import { metricsService } from '@/services/metrics.service';
import { plannerService } from '@/services/planner.service';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [weightData, setWeightData] = useState<any>(null);
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load dashboard data
      const dashboardData = await dashboardService.getDashboardData(user.id);
      setData(dashboardData);

      // Load active plan and today's workout
      const plan = await plannerService.getActivePlan(user.id);
      setActivePlan(plan);
      if (plan && plan.days && plan.days.length > 0) {
        // Simple heuristic: first training day
        const firstTrainingDay = plan.days.find((d: any) => d.day_type === 'training');
        const workout = firstTrainingDay || plan.days[0];
        setTodayWorkout(workout);

        // Check if today's workout is completed
        if (workout) {
          const isCompleted = await dashboardService.getTodayWorkoutStatus(user.id, workout.id);
          setTodayWorkoutCompleted(isCompleted);
        }
      }

      // Try to load weight data (may fail if table doesn't exist yet)
      try {
        const weightTrend = await metricsService.getWeightTrend(user.id, 12);
        setWeightData(weightTrend);

        const latest = await metricsService.getLatestBodyMetrics(user.id);
        setLatestMetrics(latest);
        if (latest?.weight_kg) {
          setWeightInput(latest.weight_kg.toString());
        }
      } catch (metricsError: any) {
        // Table might not exist yet - that's okay
        console.log('Body metrics table not yet created');
      }
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

  const handleStartWorkout = () => {
    if (todayWorkout) {
      router.push(`/workout/${todayWorkout.id}`);
    } else {
      Alert.alert('No Workout', 'No workout plan available. Create a plan first!');
    }
  };

  const handleLogMetrics = async () => {
    if (!user) return;

    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid weight');
      return;
    }

    try {
      await metricsService.logBodyMetrics(user.id, {
        weight_kg: weight
      });

      Alert.alert('Success', 'Weight logged!');
      setShowMetricsModal(false);
      Keyboard.dismiss();
      loadData(); // Refresh data
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-950">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Prepare chart data
  const chartData = weightData && weightData.length > 0 ? {
    labels: weightData.slice(-6).map((d: any) => format(new Date(d.date), 'MMM d')),
    datasets: [{
      data: weightData.slice(-6).map((d: any) => d.weight)
    }]
  } : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="py-6 mb-20">
          {/* Header */}
          <View className="flex-row justify-between items-start mb-6">
            <View>
              <Text className="text-3xl font-bold text-white">
                Hello, {data?.displayName?.split(' ')[0] || 'Athlete'}!
              </Text>
              <Text className="text-gray-400 mt-1">
                {format(new Date(), 'EEEE, d MMMM')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center">
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Workout Card */}
          {todayWorkout ? (
            <TouchableOpacity
              className={`p-6 rounded-3xl mb-6 ${todayWorkoutCompleted ? 'bg-green-600' : 'bg-blue-600'}`}
              onPress={handleStartWorkout}
              disabled={todayWorkoutCompleted}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className={`font-medium mb-1 ${todayWorkoutCompleted ? 'text-green-100' : 'text-blue-100'}`}>
                    {todayWorkoutCompleted ? "Today's Workout - Completed!" : "Today's Workout"}
                  </Text>
                  <Text className="text-3xl font-bold text-white mb-2">
                    {todayWorkout.day_name || `Day ${todayWorkout.day_number}`}
                  </Text>
                  <View className={`flex-row items-center self-start px-3 py-1 rounded-full ${todayWorkoutCompleted ? 'bg-green-500/30' : 'bg-blue-500/30'}`}>
                    <Text className="text-white text-xs font-medium">
                      {todayWorkout.exercises?.length || 0} exercises • {todayWorkout.day_type}
                    </Text>
                  </View>
                </View>
                <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                  <Text className="text-2xl">{todayWorkoutCompleted ? '✅' : '🔥'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="bg-gray-900 p-6 rounded-3xl mb-6 border border-gray-800">
              <Text className="text-gray-400 text-center">No active workout plan</Text>
              <TouchableOpacity
                className="bg-blue-600 py-3 rounded-full mt-4"
                onPress={() => router.push('/(tabs)/planner')}
              >
                <Text className="text-white font-bold text-center">Create Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Stats Grid */}
          <Text className="text-lg font-bold text-white mb-4">Weekly Stats</Text>
          <View className="flex-row justify-between mb-6">
            <View className="bg-gray-900 p-5 rounded-3xl w-[48%] border border-gray-800">
              <Text className="text-gray-400 text-sm font-medium">Workouts</Text>
              <Text className="text-3xl font-bold text-white mt-1">{data?.weeklyCount || 0}</Text>
              <Text className="text-xs text-green-500 mt-1">This Week</Text>
            </View>
            <View className="bg-gray-900 p-5 rounded-3xl w-[48%] border border-gray-800">
              <Text className="text-gray-400 text-sm font-medium">Minutes</Text>
              <Text className="text-3xl font-bold text-white mt-1">{data?.weeklyMinutes || 0}</Text>
              <Text className="text-xs text-green-500 mt-1">Active Time</Text>
            </View>
          </View>

          {/* Body Metrics Card */}
          <Text className="text-lg font-bold text-white mb-4">Body Metrics</Text>
          <View className="bg-gray-900 rounded-3xl p-6 mb-6 border border-gray-800">
            <View className="flex-row justify-between items-start mb-4">
              <View>
                <Text className="text-gray-400 text-sm">Current Weight</Text>
                <Text className="text-3xl font-bold text-white mt-1">
                  {latestMetrics?.weight_kg ? `${latestMetrics.weight_kg} kg` : '--'}
                </Text>
                {latestMetrics?.logged_at && (
                  <Text className="text-xs text-gray-500 mt-1">
                    Last updated {format(new Date(latestMetrics.logged_at), 'MMM d')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                className="bg-blue-600 px-4 py-2 rounded-full"
                onPress={() => setShowMetricsModal(true)}
              >
                <Text className="text-white font-bold">Log</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Weight Progress Chart */}
          {chartData && (
            <>
              <Text className="text-lg font-bold text-white mb-4">Weight Progress</Text>
              <View className="bg-gray-900 rounded-3xl p-4 mb-6 border border-gray-800">
                <LineChart
                  data={chartData}
                  width={Dimensions.get('window').width - 64}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#1f2937',
                    backgroundGradientFrom: '#1f2937',
                    backgroundGradientTo: '#1f2937',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                    style: {
                      borderRadius: 16
                    },
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: '#3b82f6'
                    }
                  }}
                  bezier
                  style={{
                    marginVertical: 8,
                    borderRadius: 16
                  }}
                />
              </View>
            </>
          )}

          {/* Recent Activity */}
          <Text className="text-lg font-bold text-white mb-4">Recent History</Text>
          {data?.recentActivity?.length > 0 ? (
            data.recentActivity.map((workout: any, i: number) => (
              <View key={i} className="bg-gray-900 p-4 rounded-2xl mb-3 flex-row items-center border border-gray-800">
                <View className="h-12 w-12 bg-green-900/30 rounded-full items-center justify-center mr-4">
                  <Text className="text-xl">✅</Text>
                </View>
                <View>
                  <Text className="font-semibold text-white">{workout.workout_name || 'Workout'}</Text>
                  <Text className="text-gray-400 text-sm">
                    {format(new Date(workout.completed_at), 'MMM d')} • {workout.duration_minutes} mins
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-gray-900 p-6 rounded-2xl items-center border border-gray-800">
              <Text className="text-gray-500">No workouts yet. Go start one!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Body Metrics Modal */}
      <Modal visible={showMetricsModal} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/50 justify-end">
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <View className="bg-gray-900 rounded-t-3xl p-6">
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-white font-bold text-xl">Log Weight</Text>
                  <TouchableOpacity onPress={() => {
                    setShowMetricsModal(false);
                    Keyboard.dismiss();
                  }}>
                    <Text className="text-gray-400 text-2xl">×</Text>
                  </TouchableOpacity>
                </View>

                <View className="mb-6">
                  <Text className="text-gray-400 mb-2">Weight (kg)</Text>
                  <TextInput
                    className="bg-gray-800 text-white p-4 rounded-lg border border-gray-700"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="70.5"
                    placeholderTextColor="#6b7280"
                    returnKeyType="done"
                    onSubmitEditing={handleLogMetrics}
                  />
                </View>

                <TouchableOpacity
                  className="bg-blue-600 py-4 rounded-full mb-4"
                  onPress={handleLogMetrics}
                >
                  <Text className="text-white font-bold text-center text-lg">Save Weight</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
