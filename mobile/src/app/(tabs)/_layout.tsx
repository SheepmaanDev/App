import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border
        },
        tabBarLabelStyle: {
          fontFamily: fonts.regular,
          fontSize: 11,
          fontWeight: '600'
        },
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Conteneurs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'server' : 'server-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'apps' : 'apps-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="machine"
        options={{
          title: 'Machine',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'speedometer' : 'speedometer-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Réglages',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
    </Tabs>
  );
}