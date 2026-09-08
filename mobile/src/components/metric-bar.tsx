import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  /** Pourcentage 0-100 (valeurs hors bornes bornees). */
  percent: number;
  height?: number;
}

function colorFor(percent: number): string {
  if (percent >= 85) return colors.danger;
  if (percent >= 60) return colors.warning;
  return colors.accent;
}

/** Barre de progression colorée (vert < 60 %, orange < 85 %, rouge au-dela). */
export function MetricBar({ percent, height = 10 }: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = colorFor(clamped);
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999
  }
});