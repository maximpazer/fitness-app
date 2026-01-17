import { supabase } from '@/lib/supabase'

export const authService = {
    async signUp(email: string, password: string, displayName: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                },
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
}
