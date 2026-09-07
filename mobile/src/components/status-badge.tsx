import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import type { ContainerState } from '@/types';

const STATE_LABELS: Record<ContainerState, string> = {
  running: 'Running',
  exited: 'Exited',
  paused: 'Paused',
  restarting: 'Restart',
  created: 'Created',
  dead: 'Dead',
  removing: 'Removing'
};

const STATE_COLORS: Record<ContainerState, string> = {
  running: colors.stateRunning,
  exited: colors.stateExited,
  paused: colors.statePaused,
  restarting: colors.stateRestarting,
  created: colors.stateCreated,
  dead: colors.stateDead,
  removing: colors.stateRemoving
};

interface Props {
  state: ContainerState;
}

export function StatusBadge({ state }: Props) {
  const color = STATE_COLORS[state] ?? colors.stateExited;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>
        {STATE_LABELS[state] ?? state}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  }
});