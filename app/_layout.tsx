
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide header for all screens by default
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false, // Explicitly hide for home
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="search"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="cart"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="influencers"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          headerShown: false, // Consistent with other screens
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          title: 'Admin Panel',
          headerShown: true, // Only show header for admin
          headerStyle: { backgroundColor: '#f97316' },
          headerTintColor: '#fff',
        }}
      />
    </Stack>
  );
}