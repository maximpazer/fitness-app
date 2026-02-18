import { supabase } from '@/lib/supabase'
import { Platform } from 'react-native'

const getRedirectUrl = () => {
    if (Platform.OS === 'web') {
        // Use current origin in browser (works for both localhost and production)
        if (typeof window !== 'undefined') {
            return window.location.origin
        }
        return 'https://maxum225-fitness.expo.app'
    }
    // For native apps, use the Expo scheme
    return 'fitness://'
}

export const authService = {
    async signUp(email: string, password: string, displayName: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                },
                emailRedirectTo: getRedirectUrl(),
            },
        })
        return { data, error }
    },

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { data, error }
    },

    async signOut() {
        return await supabase.auth.signOut()
    },

    async getCurrentUser() {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) return { user: null, session: null, error }
        return { user: session?.user ?? null, session, error: null }
    },

    async resetPassword(email: string) {
        return await supabase.auth.resetPasswordForEmail(email)
    },

    async updateEmail(newEmail: string) {
        return await supabase.auth.updateUser({ email: newEmail })
    },

    async updatePassword(newPassword: string) {
        return await supabase.auth.updateUser({ password: newPassword })
    },
}
