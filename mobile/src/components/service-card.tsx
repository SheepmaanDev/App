import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import type { ContainerState, ServiceEntry } from '@/types';

const STATE_META: Record<ContainerState, { label: string; color: string }> = {
  running: { label: 'En marche', color: colors.stateRunning },
  exited: { label: 'Arrêté', color: colors.stateExited },
  paused: { label: 'En pause', color: colors.statePaused },
  restarting: { label: 'Redémarrage', color: colors.stateRestarting },
  created: { label: 'Créé', color: colors.stateCreated },
  dead: { label: 'Mort', color: colors.stateDead },
  removing: { label: 'Suppression', color: colors.stateRemoving }
};

interface Props {
  service: ServiceEntry;
  /** Etat du conteneur Docker lie, si connu. */
  state: ContainerState | null;
}

/** Carte d'un service de l'annuaire (grille 2 colonnes). */
export function ServiceCard({ service, state }: Props) {
  const meta = state ? STATE_META[state] : null;
  const iconName = (service.icon ?? 'link-outline') as keyof typeof Ionicons.glyphMap;
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name={iconName} size={22} color={colors.accent} />
      </View>
      {service.category ? (
        <Text style={styles.category}>{service.category.toUpperCase()}</Text>
      ) : null}
      <Text style={styles.name} numberOfLines={2}>
        {service.name}
      </Text>
      {service.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {service.description}
        </Text>
      ) : null}
      <View style={styles.footer}>
        {meta ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 168,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs
  },
  category: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.sm
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.sm
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  }
});