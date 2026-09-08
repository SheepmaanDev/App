import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MenuButton } from '@/components/menu-button';
import { MetricBar } from '@/components/metric-bar';
import { OfflineBanner } from '@/components/offline-banner';
import { ScreenHeader } from '@/components/screen-header';
import { useOnline } from '@/hooks/use-online';
import { useBridgeConfigured, useBridgeStore } from '@/stores/use-bridge-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { HostMetricsResponse } from '@/types';
import { formatBytes, formatRate, formatUptime } from '@/utils/format';

const POLL_MS = 3000;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center'
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm
  },
  primaryButtonLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pressed: {
    opacity: 0.6
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  cardTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bigValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flexShrink: 1
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right'
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 12
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  barPercent: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 42,
    textAlign: 'right'
  },
  netRate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.mono
  },
  netTotal: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono
  }
});

export default function MachineScreen() {
  const router = useRouter();
  const configured = useBridgeConfigured();
  const getClient = useBridgeStore((state) => state.getClient);
  const online = useOnline();

  const [data, setData] = useState<HostMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!useBridgeStore.getState().baseUrl) return;
      if (mode === 'refresh') setRefreshing(true);
      if (mode !== 'silent') setError(null);
      try {
        const res = await getClient().getHostMetrics();
        setData(res);
        if (mode === 'silent') setError(null);
      } catch (err) {
        // Mode silencieux (poll 3 s) : on garde les dernieres donnees.
        if (mode !== 'silent') {
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      } finally {
        if (mode !== 'silent') {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [getClient]
  );

  useEffect(() => {
    if (configured) void load();
    else setLoading(false);
  }, [configured, load, reloadKey]);

  // Rafraichissement silencieux toutes les 3 s (CPU, RAM, reseau vivants).
  useEffect(() => {
    if (!configured) return;
    const id = setInterval(() => {
      void load('silent');
    }, POLL_MS);
    return () => clearInterval(id);
  }, [configured, load]);

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="Machine" />
        <View style={styles.center}>
          <Ionicons name="speedometer-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Pont non configuré</Text>
          <Text style={styles.emptyText}>
            Renseigne l'adresse du bridge et ton jeton dans les réglages pour
            surveiller la machine.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={16} color={colors.background} />
            <Text style={styles.primaryButtonLabel}>Aller aux réglages</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="Machine" subtitle="Chargement…" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const m = data?.metrics;
  const info = data?.host;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        left={<MenuButton />}
        title="Machine"
        subtitle={
          error
            ? 'Erreur de connexion'
            : info
              ? `${info.hostname} · ${info.distro}`
              : undefined
        }
        right={
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => setReloadKey((k) => k + 1)}
            hitSlop={10}
          >
            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
          </Pressable>
        }
      />

      <OfflineBanner visible={!online} />

      {error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.danger} />
          <Text style={styles.emptyTitle}>Connexion impossible</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
          >
            <Ionicons name="refresh" size={16} color={colors.background} />
            <Text style={styles.primaryButtonLabel}>Réessayer</Text>
          </Pressable>
        </View>
      ) : !m || !info ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucune donnée disponible.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load('refresh')}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="hardware-chip-outline" size={16} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Processeur</Text>
            </View>
            <Text style={styles.bigValue}>{m.cpu.percent.toFixed(0)} %</Text>
            <MetricBar percent={m.cpu.percent} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Charge (1 / 5 / 15 min)</Text>
              <Text style={[styles.rowValue, styles.mono]}>
                {m.cpu.load1.toFixed(2)} / {m.cpu.load5.toFixed(2)} /{' '}
                {m.cpu.load15.toFixed(2)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {info.cpuModel}
              </Text>
              <Text style={styles.rowValue}>{info.cores} threads</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="server-outline" size={16} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Mémoire</Text>
            </View>
            <Text style={styles.bigValue}>{m.memory.percent.toFixed(0)} %</Text>
            <MetricBar percent={m.memory.percent} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Utilisée</Text>
              <Text style={[styles.rowValue, styles.mono]}>
                {formatBytes(m.memory.used)} / {formatBytes(m.memory.total)}
              </Text>
            </View>
            {m.memory.swapTotal > 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Swap</Text>
                <Text style={[styles.rowValue, styles.mono]}>
                  {formatBytes(m.memory.swapUsed)} / {formatBytes(m.memory.swapTotal)}
                </Text>
              </View>
            ) : null}
          </View>

          {m.temperatureC !== null ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}>
                  <Ionicons name="thermometer-outline" size={16} color={colors.accent} />
                </View>
                <Text style={styles.cardTitle}>Température CPU</Text>
              </View>
              <Text style={styles.bigValue}>{Math.round(m.temperatureC)} °C</Text>
              <MetricBar percent={m.temperatureC} />
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="disc-outline" size={16} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Disques</Text>
            </View>
            {m.disks.length === 0 ? (
              <Text style={styles.rowLabel}>Aucun disque détecté.</Text>
            ) : (
              m.disks.map((d) => (
                <View key={`${d.mount}-${d.total}`} style={{ gap: spacing.xs }}>
                  <View style={styles.barRow}>
                    <Text style={[styles.rowLabel, styles.mono]} numberOfLines={1}>
                      {d.mount}
                    </Text>
                    <MetricBar percent={d.percent} />
                    <Text style={styles.barPercent}>{d.percent.toFixed(0)} %</Text>
                  </View>
                  <Text style={[styles.rowLabel, styles.mono]}>
                    {formatBytes(d.used)} utilisés sur {formatBytes(d.total)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="swap-horizontal-outline" size={16} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Réseau</Text>
            </View>
            {m.network.length === 0 ? (
              <Text style={styles.rowLabel}>Aucune interface détectée.</Text>
            ) : (
              m.network.map((n) => (
                <View key={n.name} style={{ gap: spacing.xs }}>
                  <View style={styles.row}>
                    <Text style={[styles.rowLabel, styles.mono]}>{n.name}</Text>
                    <Text style={styles.netRate}>
                      <Text style={{ color: colors.info }}>
                        ↓ {formatRate(n.rxRate)}
                      </Text>
                      {'   '}
                      <Text style={{ color: colors.accent }}>
                        ↑ {formatRate(n.txRate)}
                      </Text>
                    </Text>
                  </View>
                  <Text style={styles.netTotal}>
                    total ↓ {formatBytes(n.rxTotal)} · ↑ {formatBytes(n.txTotal)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Système</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Allumée depuis</Text>
              <Text style={styles.rowValue}>{formatUptime(m.uptime)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Processus</Text>
              <Text style={styles.rowValue}>
                {m.processes.running} actifs / {m.processes.all}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Noyau</Text>
              <Text style={[styles.rowValue, styles.mono]} numberOfLines={1}>
                {info.kernel}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Architecture</Text>
              <Text style={styles.rowValue}>{info.arch}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
