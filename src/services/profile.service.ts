import { Profile } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export const profileService = {
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        return { data, error }
    },

    async updateProfile(userId: string, updates: Partial<Profile>) {
        const { data, error } = await supabase
            .from('profiles')
            .upsert({ id: userId, ...updates } as any, { onConflict: 'id' })
            .select()
            .single()
        return { data, error }
    },
}
