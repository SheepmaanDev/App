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
import type { HostMetrics, HostStatic } from '@/types';

const POLL_MS = 10000;

interface HomeData {
  host: HostStatic | null;
  metrics: HostMetrics | null;
  /** Conteneurs en marche (null = donnee indisponible). */
  running: number | null;
  total: number | null;
  serviceCount: number | null;
}

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
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1
  },
  chevron: {
    marginLeft: 'auto'
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  miniLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    width: 34
  },
  miniPercent: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    width: 40,
    textAlign: 'right'
  },
  cardSub: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  bridgeLine: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono,
    textAlign: 'center',
    marginTop: spacing.sm
  }
});

export default function AccueilScreen() {
  const router = useRouter();
  const configured = useBridgeConfigured();
  const getClient = useBridgeStore((state) => state.getClient);
  const baseUrl = useBridgeStore((state) => state.baseUrl);
  const online = useOnline();

  const [data, setData] = useState<HomeData | null>(null);
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
        const client = getClient();
        // Les trois sources sont independantes : on affiche ce qui repond.
        const [host, ctr, svc] = await Promise.all([
          client.getHostMetrics().catch(() => null),
          client.listContainers().catch(() => null),
          client.listServices().catch(() => null)
        ]);
        if (!host && !ctr && !svc) {
          throw new Error('Bridge injoignable.');
        }
        setData({
          host: host?.host ?? null,
          metrics: host?.metrics ?? null,
          running: ctr
            ? ctr.containers.filter((c) => c.state === 'running').length
            : null,
          total: ctr ? ctr.containers.length : null,
          serviceCount: svc ? svc.count : null
        });
        if (mode === 'silent') setError(null);
      } catch (err) {
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

  // Rafraichissement discret toutes les 10 s (le detail vit dans les pages).
  useEffect(() => {
    if (!configured) return;
    const id = setInterval(() => {
      void load('silent');
    }, POLL_MS);
    return () => clearInterval(id);
  }, [configured, load]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        left={<MenuButton />}
        title="HomeLab"
        subtitle={
          error
            ? 'Erreur de connexion'
            : data?.host
              ? `${data.host.hostname} · ${data.host.distro}`
              : 'Tableau de bord'
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
      ) : !data ? (
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
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push('/machine')}
          >
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="speedometer-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Machine</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            {data.metrics ? (
              <>
                <View style={styles.miniBarRow}>
                  <Text style={styles.miniLabel}>CPU</Text>
                  <MetricBar percent={data.metrics.cpu.percent} height={8} />
                  <Text style={styles.miniPercent}>
                    {data.metrics.cpu.percent.toFixed(0)} %
                  </Text>
                </View>
                <View style={styles.miniBarRow}>
                  <Text style={styles.miniLabel}>RAM</Text>
                  <MetricBar percent={data.metrics.memory.percent} height={8} />
                  <Text style={styles.miniPercent}>
                    {data.metrics.memory.percent.toFixed(0)} %
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.cardSub}>Métriques indisponibles.</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push('/conteneurs')}
          >
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="server-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Conteneurs</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.cardSub}>
              {data.running !== null && data.total !== null
                ? `${data.running} en marche sur ${data.total} conteneur${data.total > 1 ? 's' : ''}`
                : 'État indisponible.'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push('/services')}
          >
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="apps-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.cardTitle}>Services</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.cardSub}>
              {data.serviceCount !== null
                ? `${data.serviceCount} service${data.serviceCount > 1 ? 's' : ''} dans l'annuaire`
                : 'Annuaire indisponible.'}
            </Text>
          </Pressable>

          <Text style={styles.bridgeLine}>Bridge : {baseUrl}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
