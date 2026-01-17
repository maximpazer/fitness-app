import { useColorScheme } from '@/hooks/use-color-scheme'
import { Stack } from 'expo-router'

export default function AuthLayout() {
    const colorScheme = useColorScheme()

    return (
        <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{
                headerShown: true,
                title: 'Create Account',
                headerBackTitle: 'Back',
                headerStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
                },
                headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
            }} />
        </Stack>
    )
}
