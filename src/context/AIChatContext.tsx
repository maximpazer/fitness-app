import { useAuthContext } from '@/context/AuthContext';
import { dashboardService } from '@/services/dashboard.service';
import { exerciseService } from '@/services/exercise.service';
import { metricsService } from '@/services/metrics.service';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type AIChatContextData = {
  metadata: any;
  contextLoading: boolean;
  refreshContext: () => Promise<void>;
};

const AIChatContext = createContext<AIChatContextData>({
  metadata: null,
  contextLoading: true,
  refreshContext: async () => {},
});

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuthContext();
  const [metadata, setMetadata] = useState<any>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const hasFetched = useRef(false);

  const loadContext = useCallback(async () => {
    if (!user) return;
    try {
      setContextLoading(true);
      const [plan, dashboardData, exercises, weightTrend, detailedHistory] = await Promise.all([
        plannerService.getActivePlan(user.id),
        dashboardService.getDashboardData(user.id),
        exerciseService.getExercises(),
        metricsService.getWeightTrend(user.id, 4),
        workoutService.getDetailedRecentHistory(user.id, 5),
      ]);

      setMetadata({
        profile,
        activePlan: plan,
        recentActivity: dashboardData?.recentActivity || [],
        exercises: exercises.map((e: any) => ({ id: e.id, name: e.name, category: e.category })),
        weightHistory: weightTrend,
        detailedHistory: detailedHistory,
      });
    } catch (e) {
      console.error('Error pre-loading AI chat context:', e);
    } finally {
      setContextLoading(false);
    }
  }, [user, profile]);

  // Auto-fetch on login / app start
  useEffect(() => {
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      loadContext();
    }
    if (!user) {
      hasFetched.current = false;
      setMetadata(null);
      setContextLoading(true);
    }
  }, [user, loadContext]);

  return (
    <AIChatContext.Provider value={{ metadata, contextLoading, refreshContext: loadContext }}>
      {children}
    </AIChatContext.Provider>
  );
}

export const useAIChatContext = () => useContext(AIChatContext);
