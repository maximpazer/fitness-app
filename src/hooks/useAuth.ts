import { useAuthContext } from '@/context/AuthContext'
import { authService } from '@/services/auth.service'

export function useAuth() {
    const { user, session, loading } = useAuthContext()

    return {
        user,
        session,
        loading,
        signIn: authService.signIn,
        signUp: authService.signUp,
        signOut: authService.signOut,
        resetPassword: authService.resetPassword,
    }
}
