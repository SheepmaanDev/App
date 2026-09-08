import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import type { ColorValue } from 'react-native';
import { colors, spacing } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function drawerIcon(name: IconName) {
  return ({
    color,
    size,
    focused
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) => (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IconName)}
      size={size}
      color={color}
    />
  );
}

/**
 * Navigationlaterale (drawer) : remplace la barre d'onglets pour liberer
 * l'ecran. Ouverture/fermeture via le bouton menu des en-tetes, le swipe
 * depuis le bord gauche, ou un appui sur la zone assombrie.
 */
export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(11, 14, 20, 0.6)',
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 264,
          borderRightWidth: 1,
          borderRightColor: colors.border
        },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.textSecondary,
        drawerActiveBackgroundColor: colors.accentDim,
        drawerLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
          marginLeft: -spacing.md
        },
        swipeEnabled: true,
        sceneStyle: { backgroundColor: colors.background }
      }}
    >
      <Drawer.Screen
        name="index"
        options={{ title: 'Accueil', drawerIcon: drawerIcon('home') }}
      />
      <Drawer.Screen
        name="machine"
        options={{ title: 'Machine', drawerIcon: drawerIcon('speedometer') }}
      />
      <Drawer.Screen
        name="conteneurs"
        options={{ title: 'Conteneurs', drawerIcon: drawerIcon('server') }}
      />
      <Drawer.Screen
        name="services"
        options={{ title: 'Services', drawerIcon: drawerIcon('apps') }}
      />
      <Drawer.Screen
        name="settings"
        options={{ title: 'Réglages', drawerIcon: drawerIcon('settings') }}
      />
    </Drawer>
  );
}