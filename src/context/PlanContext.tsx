import { FullPlan, plannerService } from '@/services/planner.service';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface PlanContextType {
    activePlan: FullPlan | null;
    loading: boolean;
    refreshPlan: () => Promise<void>;
    planVersion: number; // Increments when plan changes, triggers re-renders
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children, userId }: { children: React.ReactNode; userId: string | null }) {
    const [activePlan, setActivePlan] = useState<FullPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [planVersion, setPlanVersion] = useState(0);

    const refreshPlan = useCallback(async () => {
        if (!userId) {
            setActivePlan(null);
            setLoading(false);
            return;
        }
        
        try {
            const plan = await plannerService.getActivePlan(userId);
            setActivePlan(plan);
            setPlanVersion(v => v + 1); // Increment to signal change
        } catch (error) {
            console.error('[PlanContext] Failed to load plan:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Load plan on mount and when userId changes
    useEffect(() => {
        refreshPlan();
    }, [refreshPlan]);

    return (
        <PlanContext.Provider value={{ activePlan, loading, refreshPlan, planVersion }}>
            {children}
        </PlanContext.Provider>
    );
}

export function usePlan() {
    const context = useContext(PlanContext);
    if (context === undefined) {
        throw new Error('usePlan must be used within a PlanProvider');
    }
    return context;
}
