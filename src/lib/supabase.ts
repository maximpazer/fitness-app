import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

const ExpoStorage = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') {
            return Promise.resolve(null)
        }
        return AsyncStorage.getItem(key)
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') {
            return Promise.resolve()
        }
        return AsyncStorage.setItem(key, value)
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') {
            return Promise.resolve()
        }
        return AsyncStorage.removeItem(key)
    },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})

// AppState listener for auto-refresh
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh()
    } else {
        supabase.auth.stopAutoRefresh()
    }
})
