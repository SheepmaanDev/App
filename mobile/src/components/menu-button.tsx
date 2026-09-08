// SDK 56+ : les imports @react-navigation/* sont interdits dans le code
// applicatif — on passe par les points d'entree expo-router equivalents.
import { DrawerActions, useNavigation } from 'expo-router/react-navigation';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme';

/**
 * Bouton hamburger des en-tetes : ouvre/ferme le menu lateral (drawer)
 * pour liberer de la place sur l'ecran quand il est ferme.
 */
export function MenuButton() {
  const navigation = useNavigation();
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      hitSlop={8}
    >
      <Ionicons name="menu" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.6
  }
});