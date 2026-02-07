import { WeightInputModal } from '@/components/WeightInputModal';
import { useAuthContext } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { useWorkout } from '@/context/WorkoutContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { supabase } from '@/lib/supabase';
import { dashboardService } from '@/services/dashboard.service';
import { exerciseService } from '@/services/exercise.service';
import { metricsService } from '@/services/metrics.service';
import { planProgressionService } from '@/services/plan-progression.service';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Dashboard() {
  const { user } = useAuthContext();
  const { planVersion } = usePlan(); // Subscribe to plan changes
  const { initWorkout, setOnWorkoutComplete } = useWorkout();
  const { showDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [yesterdayWorkout, setYesterdayWorkout] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [tomorrowWorkout, setTomorrowWorkout] = useState<any>(null);
  const [weightData, setWeightData] = useState<any>(null);
  const [latestMetrics, setLatestMetrics] = useState<any>(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState(false);
  const [completedWorkoutDetails, setCompletedWorkoutDetails] = useState<any>(null);
  const [planExercises, setPlanExercises] = useState<any[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exerciseProgressData, setExerciseProgressData] = useState<Map<string, any>>(new Map());
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showWorkoutSwitcher, setShowWorkoutSwitcher] = useState(false);
  const [manuallySelectedDayId, setManuallySelectedDayId] = useState<string | null>(null);
  const [workoutAnalysis, setWorkoutAnalysis] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const [last7Days, setLast7Days] = useState<boolean[]>([]);
  const router = useRouter();

  // --- Weight Chart Filtering State ---
  const [weightRange, setWeightRange] = useState<'2m' | '6m' | '1y' | 'all'>('2m');

  // Helper to filter weightData by range
  const getFilteredWeightData = () => {
    if (!weightData) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    if (weightRange === '2m') cutoff = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    else if (weightRange === '6m') cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (weightRange === '1y') cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    if (!cutoff) return weightData;
    return weightData.filter((d: any) => new Date(d.date) >= cutoff);
  };

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
      
      if (!plan || !plan.days || plan.days.length === 0) {
        // No active plan - clear all workout-related state
        setTodayWorkout(null);
        setYesterdayWorkout(null);
        setTomorrowWorkout(null);
        setTodayWorkoutCompleted(false);
        setCompletedWorkoutDetails(null);
        setPlanExercises([]);
        setSelectedExercises([]);
        setExerciseProgressData(new Map());
      } else {
        // Extract unique exercises from all training days
        const uniqueExercises = new Map<string, any>();
        plan.days.forEach((day: any) => {
          if (day.exercises) {
            day.exercises.forEach((ex: any) => {
              if (ex.exercise && !uniqueExercises.has(ex.exercise.id)) {
                uniqueExercises.set(ex.exercise.id, ex.exercise);
              }
            });
          }
        });
        setPlanExercises(Array.from(uniqueExercises.values()));

        // First, check if any workout was completed today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const { data: todayCompleted } = await supabase
          .from('completed_workouts')
          .select('plan_day_id')
          .eq('user_id', user.id)
          .in('plan_day_id', plan.days.map(d => d.id))
          .gte('completed_at', startOfToday.toISOString())
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let workout;
        if (manuallySelectedDayId) {
          // Use manually selected day if available
          workout = plan.days.find(d => d.id === manuallySelectedDayId);
        } else if (todayCompleted) {
          // If a workout was completed today, show it as today's workout
          workout = plan.days.find(d => d.id === (todayCompleted as any).plan_day_id);
        } else {
          // Otherwise, use plan progression to suggest next workout
          const suggestedWorkout = await planProgressionService.getSuggestedWorkoutDay(user.id, plan);
          workout = suggestedWorkout || plan.days[0];
        }
        
        setTodayWorkout(workout);

        // Find yesterday's workout (the one actually completed last)
        const { data: lastCompleted } = await supabase
          .from('completed_workouts')
          .select('plan_day_id')
          .eq('user_id', user.id)
          .in('plan_day_id', plan.days.map(d => d.id))
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastCompleted) {
          setYesterdayWorkout(plan.days.find(d => d.id === (lastCompleted as any).plan_day_id));
        } else if (workout) {
          // Fallback to previous day in plan
          const currentTrainingIdx = plan.days.findIndex(d => d.id === workout.id);
          setYesterdayWorkout(plan.days[(currentTrainingIdx - 1 + plan.days.length) % plan.days.length]);
        }

        // Find tomorrow's workout (next training day in adjusted sequence)
        if (workout) {
          const sequence = planProgressionService.getUpcomingSequence(plan, workout.id, 1);
          setTomorrowWorkout(sequence[0] || plan.days.find(d => !d.day_type || d.day_type === 'training'));
        }

        // Check if today's workout is completed
        if (workout) {
          const isCompleted = await dashboardService.getTodayWorkoutStatus(user.id, workout.id);
          setTodayWorkoutCompleted(isCompleted);
          
          // If completed, fetch the workout details
          if (isCompleted) {
            const last24Hours = new Date();
            last24Hours.setHours(last24Hours.getHours() - 24);
            const { data: completedData } = await supabase
              .from('completed_workouts')
              .select('*, workout_exercises(*, exercises(*))')
              .eq('user_id', user.id)
              .eq('plan_day_id', workout.id)
              .gte('completed_at', last24Hours.toISOString())
              .order('completed_at', { ascending: false })
              .limit(1)
              .single();
            
            setCompletedWorkoutDetails(completedData);
          } else {
            setCompletedWorkoutDetails(null);
          }
        }
      }

      // Load last 7 days consistency data
      const last7DaysData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: dayWorkouts } = await supabase
          .from('completed_workouts')
          .select('id')
          .eq('user_id', user.id)
          .gte('completed_at', date.toISOString())
          .lt('completed_at', nextDay.toISOString());

        last7DaysData.push(!!(dayWorkouts && dayWorkouts.length > 0));
      }
      setLast7Days(last7DaysData);

      // Try to load weight data (may fail if table doesn't exist yet)
      try {
        const weightTrend = await metricsService.getWeightTrend(user.id, 52); // Get 1 year trend
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
      showDialog('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user, manuallySelectedDayId]);

  useEffect(() => {
    loadData();
  }, [loadData, manuallySelectedDayId, planVersion]); // Reload when plan changes

  // Set callback to refresh dashboard when workout completes
  useEffect(() => {
    setOnWorkoutComplete(() => async (analysis?: any) => {
      setManuallySelectedDayId(null); // Reset manual selection when a workout is completed
      
      // Reload dashboard data first to show completed state
      await loadData();

      // Then show the analysis modal
      if (analysis) {
        setWorkoutAnalysis(analysis);
        setShowAnalysisModal(true);
      }
    });

    return () => {
      setOnWorkoutComplete(undefined);
    };
  }, [setOnWorkoutComplete, loadData]);

  const loadExerciseProgress = async (exerciseId: string) => {
    if (!user) return;
    try {
      const progress = await exerciseService.getExerciseProgress(user.id, exerciseId, 12);
      setExerciseProgressData(prev => new Map(prev).set(exerciseId, progress));
    } catch (error) {
      console.error('Failed to load exercise progress:', error);
    }
  };

  const handleDeleteWorkout = async (workoutId: string, workoutName: string) => {
    showDialog(
      'Delete Workout',
      `Are you sure you want to delete "${workoutName}"? This cannot be undone.`,
      [
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setDeletingWorkoutId(workoutId);
              await workoutService.deleteWorkout(workoutId);
              await loadData(); // Refresh dashboard
            } catch (error) {
              console.error('Error deleting workout:', error);
              showDialog('Error', 'Failed to delete workout');
            } finally {
              setDeletingWorkoutId(null);
            }
          },
          style: 'destructive'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleExerciseSelection = (exerciseId: string) => {
    setSelectedExercises(prev => {
      const isSelected = prev.includes(exerciseId);
      const newSelection = isSelected
        ? prev.filter(id => id !== exerciseId)
        : [...prev, exerciseId];

      // Load progress for newly selected exercise
      if (!isSelected) {
        loadExerciseProgress(exerciseId);
      }

      return newSelection;
    });
  };

  const handleStartWorkout = async () => {
    if (user && todayWorkout) {
      try {
        await initWorkout(user.id, todayWorkout.id);
      } catch (e) {
        showDialog('Error', 'Could not start workout');
      }
    } else {
      showDialog('No Workout', 'No workout plan available. Create a plan first!');
    }
  };

  const handleWorkoutSwitch = (dayId: string) => {
    setManuallySelectedDayId(dayId);
    setShowWorkoutSwitcher(false);
  };

  const handleLogMetrics = async () => {
    if (!user) return;

    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      showDialog('Invalid Input', 'Please enter a valid weight');
      return;
    }

    try {
      await metricsService.logBodyMetrics(user.id, {
        weight_kg: weight
      });

      showDialog('Success', 'Weight logged!');
      setShowMetricsModal(false);
      Keyboard.dismiss();
      loadData(); // Refresh data
    } catch (error) {
      console.error(error);
      showDialog('Error', 'Failed to log weight');
    }
  };

  const [showWeightInput, setShowWeightInput] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-950">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Prepare chart data
  const chartData = weightData && weightData.length > 0 ? {
    labels: weightData.map((d: any, idx: number) => {
      // Only show ~5 labels to avoid crowding the axis
      const totalPoints = weightData.length;
      if (totalPoints <= 6) return format(new Date(d.date), 'MMM d');

      const interval = Math.floor(totalPoints / 5);
      if (idx === 0 || idx === totalPoints - 1 || (idx % interval === 0 && idx < totalPoints - interval / 2)) {
        return format(new Date(d.date), 'MMM d');
      }
      return '';
    }),
    datasets: [{
      data: weightData.map((d: any) => d.weight)
    }]
  } : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="py-6 mb-20">
          {/* Header */}
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-white">
                Hello, {data?.displayName?.split(' ')[0] || 'Athlete'}!
              </Text>
              <Text className="text-gray-400 mt-1">
                {format(new Date(), 'EEEE, d MMMM')}
              </Text>
              
              {/* Consistency Indicators - Last 7 Days */}
              {last7Days.length > 0 && (
                <View className="flex-row items-center mt-3 gap-1.5">
                  {last7Days.map((hasWorkout, index) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        hasWorkout ? 'bg-blue-500' : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => router.push('/profile' as any)} className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center">
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>

          {/* Workout Timeline Section */}
          {todayWorkout ? (
            <View className="mb-6">
              {/* Yesterday - Small Card */}
              {yesterdayWorkout && (
                <TouchableOpacity
                  className="bg-gray-900/50 border border-gray-800 p-3 rounded-2xl mb-2 flex-row justify-between items-center"
                  onPress={() => {
                    if (user && yesterdayWorkout) initWorkout(user.id, yesterdayWorkout.id);
                  }}
                >
                  <View className="flex-1">
                    <Text className="text-gray-500 font-medium text-xs mb-0.5 uppercase tracking-wider">Yesterday</Text>
                    <Text className="text-base font-bold text-gray-400">
                      {yesterdayWorkout.day_name || `Day ${yesterdayWorkout.day_number}`}
                    </Text>
                  </View>
                  <View className="bg-gray-800 px-2 py-1 rounded-full">
                    <Text className="text-gray-500 text-xs">{yesterdayWorkout.exercises?.length || 0} exercises</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Today - Prominent Card */}
              <View
                className={`p-6 rounded-3xl ${todayWorkoutCompleted ? 'bg-gray-800/60 border border-gray-700/50' : 'bg-blue-600 shadow-lg shadow-blue-500/50'}`}
              >
                <TouchableOpacity
                  onPress={handleStartWorkout}
                  disabled={todayWorkoutCompleted}
                  className="flex-row justify-between items-center"
                >
                  <View className="flex-1">
                    <Text className={`font-medium mb-1 ${todayWorkoutCompleted ? 'text-gray-400' : 'text-blue-100'}`}>
                      Today's Workout
                    </Text>
                    <Text className={`${todayWorkoutCompleted ? 'text-2xl' : 'text-3xl'} font-bold text-white mb-2`}>
                      {todayWorkout.day_name || `Day ${todayWorkout.day_number}`}
                    </Text>
                    <View className={`flex-row items-center self-start px-3 py-1 rounded-full ${todayWorkoutCompleted ? 'bg-gray-700/50' : 'bg-blue-500/30'}`}>
                      <Text className={`text-xs font-medium ${todayWorkoutCompleted ? 'text-gray-300' : 'text-white'}`}>
                        {todayWorkoutCompleted ? 'Completed today' : (todayWorkout.day_type || 'training')} • {todayWorkout.exercises?.length || 0} exercises
                      </Text>
                    </View>
                  </View>
                  {!todayWorkoutCompleted && (
                    <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                      <Ionicons name="play" size={24} color="white" style={{ marginLeft: 4 }} />
                    </View>
                  )}
                  {todayWorkoutCompleted && (
                    <View className="w-12 h-12 bg-green-500/20 rounded-full items-center justify-center">
                      <Ionicons name="checkmark" size={28} color="#22c55e" />
                    </View>
                  )}
                </TouchableOpacity>

                {todayWorkoutCompleted ? (
                  <View className="mt-4 space-y-2">
                    <TouchableOpacity
                      className="flex-row items-center justify-center bg-gray-700/50 py-3 rounded-xl border border-gray-600/50"
                      disabled
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      <Text className="text-green-400 font-bold ml-2">Workout Completed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowAnalysisModal(true)}
                      className="flex-row items-center justify-center bg-blue-600/20 py-3 rounded-xl border border-blue-500/30"
                    >
                      <Ionicons name="analytics" size={16} color="#3b82f6" />
                      <Text className="text-blue-400 font-bold ml-2">View Summary</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowWorkoutSwitcher(true)}
                    className="mt-4 flex-row items-center justify-center bg-black/10 py-2.5 rounded-xl border border-white/10"
                  >
                    <Ionicons name="swap-horizontal" size={16} color="white" />
                    <Text className="text-white font-bold ml-2">Reschedule</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tomorrow - Small Card */}
              {tomorrowWorkout && (
                <TouchableOpacity
                  className="bg-gray-900/50 border border-gray-800 p-3 rounded-2xl mt-2 flex-row justify-between items-center"
                  onPress={() => {
                    if (user && tomorrowWorkout) initWorkout(user.id, tomorrowWorkout.id);
                  }}
                >
                  <View className="flex-1">
                    <Text className="text-gray-500 font-medium text-xs mb-0.5 uppercase tracking-wider">Tomorrow</Text>
                    <Text className="text-base font-bold text-gray-400">
                      {tomorrowWorkout.day_name || `Day ${tomorrowWorkout.day_number}`}
                    </Text>
                  </View>
                  <View className="bg-gray-800 px-2 py-1 rounded-full">
                    <Text className="text-gray-500 text-xs">{tomorrowWorkout.exercises?.length || 0} exercises</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
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
              <View className="flex-row mb-2 gap-2">
                {['2m', '6m', '1y', 'all'].map((range) => (
                  <TouchableOpacity
                    key={range}
                    className={`px-3 py-1 rounded-full border ${weightRange === range ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}
                    onPress={() => setWeightRange(range as any)}
                  >
                    <Text className={`text-xs font-bold ${weightRange === range ? 'text-white' : 'text-gray-400'}`}>{
                      range === '2m' ? '2M' : range === '6m' ? '6M' : range === '1y' ? '1Y' : 'ALL'
                    }</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="bg-gray-900 rounded-3xl p-4 mb-6 border border-gray-800">
                <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ minWidth: Dimensions.get('window').width - 64 }}>
                  <LineChart
                    data={{
                      labels: getFilteredWeightData().map((d: any, idx: number) => {
                        const filtered = getFilteredWeightData();
                        const totalPoints = filtered.length;
                        if (totalPoints <= 6) return format(new Date(d.date), 'MMM d');
                        const interval = Math.ceil(totalPoints / 4);
                        if (idx === 0 || idx === totalPoints - 1 || (idx % interval === 0 && idx < totalPoints - interval / 2)) {
                          return format(new Date(d.date), 'MMM d');
                        }
                        return '';
                      }),
                      datasets: [{ data: getFilteredWeightData().map((d: any) => d.weight) }]
                    }}
                    width={Math.max(Dimensions.get('window').width - 64, getFilteredWeightData().length * 60)}
                    height={220}
                    fromZero={false}
                    withHorizontalLines={true}
                    withVerticalLines={false}
                    withInnerLines={true}
                    chartConfig={{
                      backgroundColor: '#1f2937',
                      backgroundGradientFrom: '#1f2937',
                      backgroundGradientTo: '#1f2937',
                      decimalPlaces: 1,
                      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                      labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                      propsForBackgroundLines: {
                        strokeDasharray: '',
                        stroke: 'rgba(55, 65, 81, 0.3)',
                        strokeWidth: 1
                      },
                      style: {
                        borderRadius: 16
                      },
                      propsForDots: {
                        r: '0'
                      },
                      strokeWidth: 3
                    }}
                    bezier
                    style={{
                      marginVertical: 8,
                      borderRadius: 16
                    }}
                  />
                </ScrollView>
              </View>
            </>
          )}

          {/* Exercise Progress */}
          {planExercises.length > 0 && (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-white">Exercise Progress</Text>
                <TouchableOpacity
                  className="bg-blue-600 px-4 py-2 rounded-full"
                  onPress={() => setShowExerciseSelector(true)}
                >
                  <Text className="text-white text-sm font-bold">Select Exercises</Text>
                </TouchableOpacity>
              </View>

              {selectedExercises.length > 0 ? (
                <View className="mb-6">
                  <FlatList
                    data={selectedExercises}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 32));
                      setCurrentExerciseIndex(index);
                    }}
                    renderItem={({ item: exerciseId }) => {
                      const exercise = planExercises.find(ex => ex.id === exerciseId);
                      const progressData = exerciseProgressData.get(exerciseId);

                      const chartData = progressData && progressData.length > 0 ? {
                        labels: progressData.map((d: any, idx: number) => {
                          const totalPoints = progressData.length;
                          if (totalPoints <= 6) return format(new Date(d.date), 'MMM d');
                          const interval = Math.floor(totalPoints / 5);
                          if (idx === 0 || idx === totalPoints - 1 || (idx % interval === 0 && idx < totalPoints - interval / 2)) {
                            return format(new Date(d.date), 'MMM d');
                          }
                          return '';
                        }),
                        datasets: [{
                          data: progressData.map((d: any) => d.weight),
                          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`
                        }]
                      } : null;

                      return (
                        <View style={{ width: Dimensions.get('window').width - 32 }}>
                          <View className="bg-gray-900 rounded-3xl p-4 mr-4 border border-gray-800">
                            <Text className="text-white font-bold text-lg mb-2">{exercise?.name}</Text>
                            {chartData ? (
                              <LineChart
                                data={chartData}
                                width={Dimensions.get('window').width - 80}
                                height={200}
                                fromZero={false}
                                withHorizontalLines={true}
                                withVerticalLines={false}
                                withInnerLines={true}
                                chartConfig={{
                                  backgroundColor: '#1f2937',
                                  backgroundGradientFrom: '#1f2937',
                                  backgroundGradientTo: '#1f2937',
                                  decimalPlaces: 1,
                                  color: (opacity = 1) => `rgba(159, 130, 254, 1)`,
                                  labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                                  propsForBackgroundLines: {
                                    strokeDasharray: '',
                                    stroke: 'rgba(55, 65, 81, 0.3)',
                                    strokeWidth: 1
                                  },
                                  style: { borderRadius: 16 },
                                  propsForDots: {
                                    r: '0'
                                  },
                                  strokeWidth: 3
                                }}
                                bezier
                                style={{ marginVertical: 8, borderRadius: 16 }}
                              />
                            ) : (
                              <View className="items-center justify-center py-12">
                                <Text className="text-gray-500 text-center">No workout data yet for this exercise</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    }}
                    keyExtractor={(item) => item}
                  />

                  {/* Pagination Dots */}
                  {selectedExercises.length > 1 && (
                    <View className="flex-row justify-center mt-3 gap-2">
                      {selectedExercises.map((_, index) => (
                        <View
                          key={index}
                          className={`h-2 rounded-full ${index === currentExerciseIndex ? 'bg-blue-600 w-6' : 'bg-gray-700 w-2'
                            }`}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View className="bg-gray-900 rounded-3xl p-6 mb-6 border border-gray-800">
                  <Text className="text-gray-400 text-center">Select exercises to track your progress</Text>
                </View>
              )}
            </>
          )}

          {/* Recent Activity */}
          <Text className="text-lg font-bold text-white mb-4">Recent History</Text>
          {data?.recentActivity?.length > 0 ? (
            data.recentActivity.map((workout: any, i: number) => (
              <View
                key={i}
                className="bg-gray-900 p-4 rounded-2xl mb-3 border border-gray-800 flex-row items-center justify-between"
              >
                <TouchableOpacity
                  onPress={() => router.push(`/workout/summary/${workout.id}` as any)}
                  className="flex-row items-center flex-1"
                >
                  <View className="h-10 w-10 bg-blue-900/20 rounded-xl items-center justify-center mr-4">
                    <Ionicons name="calendar-outline" size={20} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-white" numberOfLines={1}>{workout.workout_name || 'Workout'}</Text>
                    <Text className="text-gray-400 text-sm">
                      {format(new Date(workout.completed_at), 'MMM d')} • {workout.duration_minutes} mins
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#4b5563" className="mr-2" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteWorkout(workout.id, workout.workout_name || 'Workout');
                  }}
                  className="bg-red-500/10 p-2.5 rounded-lg ml-2"
                  disabled={deletingWorkoutId === workout.id}
                >
                  {deletingWorkoutId === workout.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  )}
                </TouchableOpacity>
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
                  <View className="flex-row items-center">
                    <TouchableOpacity
                      className="bg-gray-800 p-3 rounded-l-lg border border-gray-700 border-r-0"
                      onPress={() => {
                        let val = parseFloat(weightInput) || 0;
                        val = Math.max(0, Math.round((val - 0.5) * 2) / 2);
                        setWeightInput(val > 0 ? val.toFixed(1) : '');
                      }}
                      accessibilityLabel="Decrease weight by 0.5kg"
                    >
                      <Text className="text-white text-xl">-</Text>
                    </TouchableOpacity>
                    <TextInput
                      className="bg-gray-800 text-white p-4 border-t border-b border-gray-700 w-24 text-center"
                      value={weightInput}
                      onChangeText={text => {
                        // Only allow numbers and one decimal
                        if (/^\d*(\.\d{0,1})?$/.test(text)) setWeightInput(text);
                      }}
                      keyboardType="decimal-pad"
                      placeholder="70.5"
                      placeholderTextColor="#6b7280"
                      returnKeyType="done"
                      onSubmitEditing={handleLogMetrics}
                    />
                    <TouchableOpacity
                      className="bg-gray-800 p-3 rounded-r-lg border border-gray-700 border-l-0"
                      onPress={() => {
                        let val = parseFloat(weightInput) || 0;
                        val = Math.round((val + 0.5) * 2) / 2;
                        setWeightInput(val > 0 ? val.toFixed(1) : '0.5');
                      }}
                      accessibilityLabel="Increase weight by 0.5kg"
                    >
                      <Text className="text-white text-xl">+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  className="bg-blue-600 py-4 rounded-full mb-4"
                  onPress={handleLogMetrics}
                >
                  <Text className="text-white font-bold text-center text-lg">Log</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Workout Switcher Modal */}
      <Modal visible={showWorkoutSwitcher} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity
            className="flex-1"
            onPress={() => setShowWorkoutSwitcher(false)}
            activeOpacity={1}
          />
          <View className="bg-gray-900 rounded-t-3xl p-6 border-t border-gray-800">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-white font-bold text-xl">Switch Workout Day</Text>
                <Text className="text-gray-400 text-xs mt-1">Pick your training for today</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowWorkoutSwitcher(false)}
                className="bg-gray-800 p-2 rounded-full"
              >
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
              {activePlan?.days?.filter((d: any) => !d.day_type || d.day_type === 'training').map((day: any) => (
                <TouchableOpacity
                  key={day.id}
                  className={`p-5 rounded-2xl mb-3 flex-row items-center justify-between border ${day.id === todayWorkout?.id
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-gray-800/50 border-gray-700'
                    }`}
                  onPress={() => handleWorkoutSwitch(day.id)}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Text className={`font-bold text-lg ${day.id === todayWorkout?.id ? 'text-blue-400' : 'text-white'}`}>
                        {day.day_name || `Day ${day.day_number}`}
                      </Text>
                      {day.id === todayWorkout?.id && (
                        <View className="bg-blue-500/20 px-2 py-0.5 rounded-md ml-3">
                          <Text className="text-blue-400 text-[10px] font-bold uppercase">Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-gray-500 text-xs">
                      {day.exercises?.length || 0} exercises
                    </Text>
                  </View>
                  <Ionicons
                    name={day.id === todayWorkout?.id ? "checkmark-circle" : "chevron-forward"}
                    size={22}
                    color={day.id === todayWorkout?.id ? "#3b82f6" : "#4b5563"}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="h-4" />
          </View>
        </View>
      </Modal>

      {/* Exercise Selector Modal */}
      <Modal
        visible={showExerciseSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExerciseSelector(false)}
      >
        <SafeAreaView className="flex-1 bg-gray-950">
          <View className="flex-1">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-800">
              <Text className="text-xl font-bold text-white">Select Exercises to Track</Text>
              <TouchableOpacity onPress={() => setShowExerciseSelector(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4">
              {Object.entries(
                planExercises.reduce((acc, exercise) => {
                  const category = (exercise.category || 'other').toLowerCase();
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(exercise);
                  return acc;
                }, {} as Record<string, any[]>)
              )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, exercises]) => (
                  <View key={category}>
                    <Text className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-3 mt-4 first:mt-0">
                      {category.replace('_', ' ')}
                    </Text>
                    {(exercises as any[])
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((exercise) => (
                        <TouchableOpacity
                          key={exercise.id}
                          className={`p-4 rounded-2xl mb-3 flex-row items-center justify-between border ${selectedExercises.includes(exercise.id)
                            ? 'bg-blue-600/20 border-blue-500'
                            : 'bg-gray-900 border-gray-800'
                            }`}
                          onPress={() => handleExerciseSelection(exercise.id)}
                        >
                          <View className="flex-1">
                            <Text className={`font-bold text-base ${selectedExercises.includes(exercise.id) ? 'text-blue-400' : 'text-white'
                              }`}>
                              {exercise.name}
                            </Text>
                          </View>
                          {selectedExercises.includes(exercise.id) && (
                            <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                          )}
                        </TouchableOpacity>
                      ))}
                  </View>
                ))}
            </ScrollView>

            <View className="p-4 border-t border-gray-800">
              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-full"
                onPress={() => setShowExerciseSelector(false)}
              >
                <Text className="text-white font-bold text-center text-lg">
                  Done ({selectedExercises.length} selected)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* AI Analysis Modal */}
      <Modal visible={showAnalysisModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/80 justify-center px-6">
          <View className="bg-gray-900 rounded-[32px] p-8 border border-gray-800 overflow-hidden">
            {/* Background Decorative Element */}
            <View className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl" />

            <View className="items-center mb-6">
              <View className="bg-blue-600/20 p-4 rounded-2xl mb-4">
                <Ionicons name="analytics" size={32} color="#3b82f6" />
              </View>
              <Text className="text-white font-bold text-2xl text-center">Workout Analysis</Text>
              <Text className="text-gray-400 text-center mt-2 text-sm">
                Data-driven insights from your session
              </Text>
            </View>

            <ScrollView className="max-h-[50vh]" showsVerticalScrollIndicator={false}>
              {/* POSITIVE INSIGHT */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="bg-green-500/20 p-1.5 rounded-lg mr-2">
                    <Ionicons name="trophy" size={16} color="#22c55e" />
                  </View>
                  <Text className="text-green-400 font-bold uppercase tracking-widest text-[10px]">Achievement</Text>
                </View>
                <View className="bg-gray-800/40 p-4 rounded-xl">
                  <Text className="text-gray-200 text-sm leading-5 font-medium">
                    {workoutAnalysis?.positive_insight}
                  </Text>
                </View>
              </View>

              {/* COMPARISON */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View className="bg-purple-500/20 p-1.5 rounded-lg mr-2">
                    <Ionicons name="bar-chart" size={16} color="#a855f7" />
                  </View>
                  <Text className="text-purple-400 font-bold uppercase tracking-widest text-[10px]">vs Last Session</Text>
                </View>
                <View className="bg-gray-800/40 p-4 rounded-xl">
                  <Text className="text-gray-200 text-sm leading-5 font-medium">
                    {workoutAnalysis?.comparison}
                  </Text>
                </View>
              </View>

              {/* NEXT SESSION */}
              <View className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="arrow-forward" size={18} color="#3b82f6" className="mr-2" />
                  <Text className="text-blue-400 font-bold text-xs uppercase tracking-widest">Next Session</Text>
                </View>
                <Text className="text-gray-200 text-sm leading-5 font-medium">
                  {workoutAnalysis?.next_session}
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              className="bg-blue-600 py-4 rounded-2xl mt-8 shadow-lg shadow-blue-500/20"
              onPress={() => setShowAnalysisModal(false)}
            >
              <Text className="text-white font-bold text-center text-lg">Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <WeightInputModal
        visible={showWeightInput}
        initialValue={weightInput}
        onSave={async (val) => {
          if (!user) return;
          const weight = parseFloat(val);
          if (isNaN(weight) || weight <= 0) {
            showDialog('Invalid Input', 'Please enter a valid weight');
            return;
          }
          try {
            await metricsService.logBodyMetrics(user.id, { weight_kg: weight });
            showDialog('Success', 'Weight logged!');
            setShowWeightInput(false);
            loadData();
          } catch (error) {
            showDialog('Error', 'Failed to log weight');
          }
        }}
        onClose={() => setShowWeightInput(false)}
      />
    </SafeAreaView>
  );
}
