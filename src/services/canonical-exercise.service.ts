/**
 * Canonical Exercise Service
 * 
 * Handles the canonical exercise layer - a curated set of 30 core exercises
 * that the AI selects from. Backend intelligently picks the best variant
 * based on user's available equipment.
 * 
 * Flow:
 * 1. AI searches canonical_exercises (30 options)
 * 2. AI selects canonical names: "bench_press", "squat", "deadlift"
 * 3. This service picks the best variant for each canonical based on user equipment
 * 4. Returns full exercise with video, instructions, etc.
 */

import { supabase } from '@/lib/supabase';

export interface CanonicalExercise {
    id: string;
    canonical_name: string;
    display_name: string;
    movement_pattern: string;
    primary_muscle: string;
    secondary_muscles: string[];
    equipment_category: string;
    difficulty_level: string;
}

export interface ExerciseVariant {
    id: string;
    name: string;
    equipment_needed: string[];
    difficulty: string;
    video_url?: string;
    gif_url?: string;
    instructions?: string[];
}

// Equipment priority order (most preferred first)
const EQUIPMENT_PRIORITY: Record<string, number> = {
    'Barbell': 10,      // Best for compounds
    'Dumbbell': 9,      // Versatile
    'Cable': 8,         // Good for isolation
    'Machine': 7,       // Safe, beginner-friendly
    'Bodyweight': 6,    // Always available
    'Kettlebell': 5,    // Functional
    'Resistance Band': 4,
    'Smith Machine': 3,
    'EZ Bar': 3,
    'Trap Bar': 3,
};

class CanonicalExerciseService {
    
    /**
     * Get all canonical exercises for AI to search
     * Returns simplified list for AI selection (not full exercise database)
     */
    async getCanonicalExercises(filters?: {
        movement_pattern?: string;
        primary_muscle?: string;
        equipment_category?: string;
    }): Promise<CanonicalExercise[]> {
        let query = supabase
            .from('canonical_exercises')
            .select('*')
            .eq('is_active', true)
            .order('sort_order');
        
        if (filters?.movement_pattern) {
            query = query.eq('movement_pattern', filters.movement_pattern);
        }
        if (filters?.primary_muscle) {
            query = query.ilike('primary_muscle', `%${filters.primary_muscle}%`);
        }
        if (filters?.equipment_category) {
            query = query.eq('equipment_category', filters.equipment_category);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('[CanonicalExercise] Failed to fetch canonicals:', error);
            return [];
        }
        
        return data || [];
    }
    
    /**
     * Search canonical exercises by query
     * Used by AI tool to find exercises for plan creation
     */
    async searchCanonicals(query?: string, muscle?: string): Promise<{
        results: Array<{
            canonical_name: string;
            display_name: string;
            movement_pattern: string;
            primary_muscle: string;
            equipment_category: string;
        }>;
        total: number;
    }> {
        let dbQuery = supabase
            .from('canonical_exercises')
            .select('canonical_name, display_name, movement_pattern, primary_muscle, equipment_category')
            .eq('is_active', true)
            .order('sort_order');
        
        if (query) {
            // Search by canonical_name or display_name
            dbQuery = dbQuery.or(`canonical_name.ilike.%${query}%,display_name.ilike.%${query}%,primary_muscle.ilike.%${query}%`);
        }
        
        if (muscle) {
            dbQuery = dbQuery.ilike('primary_muscle', `%${muscle}%`);
        }
        
        const { data, error } = await dbQuery;
        
        if (error) {
            console.error('[CanonicalExercise] Search failed:', error);
            return { results: [], total: 0 };
        }
        
        return {
            results: data || [],
            total: (data || []).length,
        };
    }
    
    /**
     * Select the best variant for a canonical exercise based on user's equipment
     * 
     * @param canonicalName - e.g., "bench_press", "squat"
     * @param userEquipment - User's available equipment (from profile)
     * @param preferredDifficulty - Optional difficulty preference
     */
    async selectVariant(
        canonicalName: string,
        userEquipment?: string[],
        preferredDifficulty?: 'beginner' | 'intermediate' | 'advanced'
    ): Promise<ExerciseVariant | null> {
        // First, get the canonical ID
        const { data: canonical, error: canonicalError } = await supabase
            .from('canonical_exercises')
            .select('id, equipment_category')
            .eq('canonical_name', canonicalName)
            .single();
        
        if (canonicalError || !canonical) {
            console.error(`[CanonicalExercise] Canonical not found: ${canonicalName}`);
            return null;
        }
        
        const typedCanonical = canonical as { id: string; equipment_category: string };
        
        // Get all variants for this canonical
        const { data: variants, error: variantError } = await supabase
            .from('exercises')
            .select('id, name, equipment_needed, difficulty, video_url, gif_url, instructions')
            .eq('canonical_id', typedCanonical.id);
        
        if (variantError || !variants || variants.length === 0) {
            console.warn(`[CanonicalExercise] No variants found for: ${canonicalName}`);
            return null;
        }
        
        // Score each variant based on user equipment and preferences
        const scoredVariants = variants.map((v: any) => {
            let score = 0;
            const equipment = v.equipment_needed || [];
            
            // 1. Equipment matching
            if (userEquipment && userEquipment.length > 0) {
                // Check if user has the required equipment
                const hasEquipment = equipment.every((eq: string) => 
                    eq === 'Bodyweight' || userEquipment.some(ue => 
                        ue.toLowerCase().includes(eq.toLowerCase()) ||
                        eq.toLowerCase().includes(ue.toLowerCase())
                    )
                );
                
                if (hasEquipment) {
                    score += 50; // Big boost for having the equipment
                }
            } else {
                // No user equipment info - prefer common equipment
                for (const eq of equipment) {
                    score += EQUIPMENT_PRIORITY[eq] || 1;
                }
            }
            
            // 2. Equipment type priority (barbell > dumbbell > machine for compounds)
            for (const eq of equipment) {
                score += EQUIPMENT_PRIORITY[eq] || 1;
            }
            
            // 3. Difficulty matching
            if (preferredDifficulty) {
                if (v.difficulty === preferredDifficulty) {
                    score += 10;
                } else if (
                    (preferredDifficulty === 'intermediate' && v.difficulty !== 'advanced') ||
                    (preferredDifficulty === 'beginner' && v.difficulty === 'beginner')
                ) {
                    score += 5;
                }
            }
            
            // 4. Prefer exercises with videos
            if (v.video_url) score += 5;
            if (v.gif_url) score += 2;
            
            // 5. Prefer simpler names (usually more standard variations)
            const wordCount = v.name.split(' ').length;
            if (wordCount <= 3) score += 3;
            else if (wordCount <= 4) score += 1;
            
            return { ...v, score };
        });
        
        // Sort by score (highest first)
        scoredVariants.sort((a, b) => b.score - a.score);
        
        const selected = scoredVariants[0];
        
        if (__DEV__) {
            console.log(`[CanonicalExercise] ${canonicalName} -> ${selected.name} (score: ${selected.score})`);
        }
        
        return {
            id: selected.id,
            name: selected.name,
            equipment_needed: selected.equipment_needed || [],
            difficulty: selected.difficulty,
            video_url: selected.video_url,
            gif_url: selected.gif_url,
            instructions: selected.instructions,
        };
    }
    
    /**
     * Batch select variants for multiple canonical exercises
     * More efficient than calling selectVariant multiple times
     */
    async selectVariantsBatch(
        canonicalNames: string[],
        userEquipment?: string[],
        preferredDifficulty?: 'beginner' | 'intermediate' | 'advanced'
    ): Promise<Map<string, ExerciseVariant | null>> {
        const results = new Map<string, ExerciseVariant | null>();
        
        if (canonicalNames.length === 0) {
            return results;
        }
        
        // Fetch all canonical IDs at once
        const { data: canonicals, error: canonicalError } = await supabase
            .from('canonical_exercises')
            .select('id, canonical_name')
            .in('canonical_name', canonicalNames);
        
        if (canonicalError || !canonicals || canonicals.length === 0) {
            console.error('[CanonicalExercise] Batch fetch failed:', canonicalError);
            canonicalNames.forEach(name => results.set(name, null));
            return results;
        }
        
        const typedCanonicals = canonicals as Array<{ id: string; canonical_name: string }>;
        const canonicalIds = typedCanonicals.map(c => c.id);
        
        // Fetch all variants for these canonicals at once
        const { data: variants, error: variantError } = await supabase
            .from('exercises')
            .select('id, name, equipment_needed, difficulty, video_url, gif_url, instructions, canonical_id')
            .in('canonical_id', canonicalIds);
        
        if (variantError || !variants || variants.length === 0) {
            console.error('[CanonicalExercise] Batch variant fetch failed:', variantError);
            canonicalNames.forEach(name => results.set(name, null));
            return results;
        }
        
        const typedVariants = variants as Array<{
            id: string;
            name: string;
            equipment_needed: string[];
            difficulty: string;
            video_url: string | null;
            gif_url: string | null;
            instructions: string[] | null;
            canonical_id: string;
        }>;
        
        // Group variants by canonical_id
        const variantsByCanonical = new Map<string, typeof typedVariants>();
        for (const v of typedVariants) {
            const existing = variantsByCanonical.get(v.canonical_id) || [];
            existing.push(v);
            variantsByCanonical.set(v.canonical_id, existing);
        }
        
        // Select best variant for each canonical
        for (const canonical of typedCanonicals) {
            const canonicalVariants = variantsByCanonical.get(canonical.id) || [];
            
            if (canonicalVariants.length === 0) {
                results.set(canonical.canonical_name, null);
                continue;
            }
            
            // Score and select (same logic as selectVariant)
            const scoredVariants = canonicalVariants.map((v) => {
                let score = 0;
                const equipment = v.equipment_needed || [];
                
                if (userEquipment && userEquipment.length > 0) {
                    const hasEquipment = equipment.every((eq: string) => 
                        eq === 'Bodyweight' || userEquipment.some(ue => 
                            ue.toLowerCase().includes(eq.toLowerCase()) ||
                            eq.toLowerCase().includes(ue.toLowerCase())
                        )
                    );
                    if (hasEquipment) score += 50;
                } else {
                    for (const eq of equipment) {
                        score += EQUIPMENT_PRIORITY[eq] || 1;
                    }
                }
                
                for (const eq of equipment) {
                    score += EQUIPMENT_PRIORITY[eq] || 1;
                }
                
                if (preferredDifficulty && v.difficulty === preferredDifficulty) {
                    score += 10;
                }
                
                if (v.video_url) score += 5;
                if (v.gif_url) score += 2;
                
                const wordCount = v.name.split(' ').length;
                if (wordCount <= 3) score += 3;
                
                return { ...v, score };
            });
            
            scoredVariants.sort((a, b) => b.score - a.score);
            const selected = scoredVariants[0];
            
            results.set(canonical.canonical_name, {
                id: selected.id,
                name: selected.name,
                equipment_needed: selected.equipment_needed || [],
                difficulty: selected.difficulty,
                video_url: selected.video_url || undefined,
                gif_url: selected.gif_url || undefined,
                instructions: selected.instructions || undefined,
            });
        }
        
        // Set null for any not found
        for (const name of canonicalNames) {
            if (!results.has(name)) {
                results.set(name, null);
            }
        }
        
        return results;
    }
    
    /**
     * Get canonical by name (for validation)
     */
    async getCanonicalByName(canonicalName: string): Promise<CanonicalExercise | null> {
        const { data, error } = await supabase
            .from('canonical_exercises')
            .select('*')
            .eq('canonical_name', canonicalName)
            .single();
        
        if (error || !data) return null;
        return data;
    }
}

export const canonicalExerciseService = new CanonicalExerciseService();
