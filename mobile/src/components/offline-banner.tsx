import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

interface Props {
  visible: boolean;
}

/** Bandeau affiche quand l'appareil perd sa connexion reseau. */
export function OfflineBanner({ visible }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Ionicons name="wifi-outline" size={14} color={colors.warning} />
      <Text style={styles.text}>Hors ligne — reseau indisponible</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 177, 95, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  text: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.regular
  }
});