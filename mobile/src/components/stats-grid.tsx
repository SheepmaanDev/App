import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '@/theme';
import type { ContainerStats } from '@/types';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  const units = ['o', 'Kio', 'Mio', 'Gio', 'Tio'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Grille d'indicateurs d'un conteneur (CPU, RAM, reseau, disque, PIDs).
 * `null` = conteneur arrete : on affiche un message discret.
 */
export function StatsGrid({ stats }: { stats: ContainerStats | null }) {
  if (!stats) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Les stats sont disponibles quand le conteneur tourne.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <StatCard label="CPU" value={`${stats.cpuPercent.toFixed(2)} %`} />
      <StatCard
        label="Mémoire"
        value={formatBytes(stats.memUsage)}
        sub={`${stats.memPercent.toFixed(1)} % de ${formatBytes(stats.memLimit)}`}
      />
      <StatCard
        label="Réseau"
        value={`↓ ${formatBytes(stats.netRxBytes)}`}
        sub={`↑ ${formatBytes(stats.netTxBytes)}`}
      />
      <StatCard
        label="Disque"
        value={`L ${formatBytes(stats.blockReadBytes)}`}
        sub={`É ${formatBytes(stats.blockWriteBytes)}`}
      />
      <StatCard label="Processus" value={String(stats.pids)} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.mono
  },
  sub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.mono
  },
  empty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic'
  }
});