import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/status-badge';
import { colors, radius, shadows, spacing } from '@/theme';
import type { ContainerAction, ContainerSummary } from '@/types';

interface ContainerCardProps {
  container: ContainerSummary;
  pending: ContainerAction | null;
  onAction: (id: string, action: ContainerAction) => void;
  /** Si fourni, la carte est cliquable (ouvre l'ecran detail). */
  onPress?: () => void;
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  pending: boolean;
  onPress: () => void;
}

function ActionButton({ icon, label, color, pending, onPress }: ActionButtonProps) {
  const accent = color ?? colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: accent },
        pressed && styles.actionPressed
      ]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={color ?? colors.textSecondary} />
      ) : (
        <Ionicons name={icon} size={15} color={accent} />
      )}
      <Text style={[styles.actionLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

export function ContainerCard({ container, pending, onAction, onPress }: ContainerCardProps) {
  const running = container.state === 'running';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, onPress && pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {container.name.replace(/^\//, '')}
          </Text>
          <StatusBadge state={container.state} />
        </View>
        <Text style={styles.image} numberOfLines={1}>
          {container.image}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          {container.status}
        </Text>
      </View>

      <View style={styles.footer}>
        {container.ports.length > 0 ? (
          <View style={styles.ports}>
            {container.ports.slice(0, 3).map((port, index) => (
              <Text key={`${port.containerPort}-${index}`} style={styles.port}>
                {port.containerPort}
                {port.hostPort && port.hostPort !== port.containerPort
                  ? ` → ${port.hostPort}`
                  : ''}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.portMuted}>aucun port exposé</Text>
        )}

        <View style={styles.actions}>
          {running ? (
            <>
              <ActionButton
                icon="refresh"
                label="Restart"
                pending={pending === 'restart'}
                onPress={() => onAction(container.id, 'restart')}
              />
              <ActionButton
                icon="stop"
                label="Stop"
                color={colors.danger}
                pending={pending === 'stop'}
                onPress={() => onAction(container.id, 'stop')}
              />
            </>
          ) : (
            <ActionButton
              icon="play"
              label="Start"
              color={colors.accent}
              pending={pending === 'start'}
              onPress={() => onAction(container.id, 'start')}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows
  },
  header: {
    gap: spacing.xs
  },
  cardPressed: {
    opacity: 0.8
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1
  },
  image: {
    color: colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 12
  },
  status: {
    color: colors.textMuted,
    fontSize: 12
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  ports: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flexShrink: 1
  },
  port: {
    color: colors.info,
    fontFamily: 'monospace',
    fontSize: 11,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  portMuted: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic'
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionPressed: {
    opacity: 0.6
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600'
  }
});