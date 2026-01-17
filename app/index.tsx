import { Redirect } from 'expo-router';

export default function Index() {
    // In a real app, check authentication here.
    // if (!user) return <Redirect href="/auth" />;
    return <Redirect href="/(tabs)" />;
}
