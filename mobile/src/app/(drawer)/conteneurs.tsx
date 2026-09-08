import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContainerCard } from '@/components/container-card';
import { MenuButton } from '@/components/menu-button';
import { OfflineBanner } from '@/components/offline-banner';
import { ScreenHeader } from '@/components/screen-header';
import { useOnline } from '@/hooks/use-online';
import { useBridgeConfigured, useBridgeStore } from '@/stores/use-bridge-store';
import { colors, spacing } from '@/theme';
import type { ContainerAction, ContainerSummary } from '@/types';
import { confirmDialog, showError } from '@/utils/confirm';
import { hapticError, hapticImpact, hapticSuccess } from '@/utils/haptics';

interface PendingState {
  id: string;
  action: ContainerAction;
}

type StateFilter = 'all' | 'running' | 'stopped';

const FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'running', label: 'En marche' },
  { key: 'stopped', label: 'Arrêtés' }
];

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
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.md
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600'
  },
  chipLabelActive: {
    color: colors.accent
  },
  chipCount: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700'
  }
});

export default function ContainersScreen() {
  const router = useRouter();
  const configured = useBridgeConfigured();
  const getClient = useBridgeStore((state) => state.getClient);

  const [containers, setContainers] = useState<ContainerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StateFilter>('all');
  const online = useOnline();
  const autoRefresh = useBridgeStore((state) => state.autoRefresh);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!useBridgeStore.getState().baseUrl) return;
      if (mode === 'refresh') setRefreshing(true);
      if (mode !== 'silent') setError(null);
      try {
        const data = await getClient().listContainers();
        setContainers(data.containers);
        if (mode === 'silent') setError(null);
      } catch (error) {
        // En mode silencieux (auto-refresh), on conserve les donnees affichees
        // et on ne derange pas l'utilisateur (le bandeau hors-ligne s'affiche
        // deja si le reseau est coupe).
        if (mode !== 'silent') {
          setError(error instanceof Error ? error.message : 'Erreur inconnue');
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

  // Rafraichissement automatique silencieux (intervalle choisi en reglages).
  useEffect(() => {
    if (!configured || autoRefresh === 0) return;
    const id = setInterval(() => {
      void load('silent');
    }, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, configured, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return containers.filter((c) => {
      if (filter === 'running' && c.state !== 'running') return false;
      if (filter === 'stopped' && c.state === 'running') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)
      );
    });
  }, [containers, filter, query]);

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.length - runningCount;

  const handleAction = useCallback(
    async (id: string, action: ContainerAction) => {
      void hapticImpact();
      const container = containers.find((c) => c.id === id);
      const name = container?.name.replace(/^\//, '') ?? id;

      if (action === 'stop' && container) {
        const ok = await confirmDialog(
          `Arrêter « ${name} » ?`,
          'Le conteneur va être arrêté. Cette action peut interrompre des services.'
        );
        if (!ok) return;
      }

      setPending({ id, action });
      try {
        await getClient()[action](id);
        await hapticSuccess();
        await load('refresh');
      } catch (error) {
        await hapticError();
        showError(
          'Action impossible',
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setPending(null);
      }
    },
    [containers, getClient, load]
  );

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="Conteneurs" subtitle="Pont homelab" />
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Pont non configuré</Text>
          <Text style={styles.emptyText}>
            Renseigne l'adresse du bridge et ton jeton dans les réglages pour
            piloter tes services Docker.
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
        <ScreenHeader title="Conteneurs" subtitle="Chargement…" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        left={<MenuButton />}
        title="Conteneurs"
        subtitle={
          error
            ? 'Erreur de connexion'
            : `${containers.length} conteneur${containers.length > 1 ? 's' : ''}`
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

      {error && !refreshing ? null : (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher (nom, image)…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.chipsRow}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count =
                f.key === 'all'
                  ? containers.length
                  : f.key === 'running'
                    ? runningCount
                    : stoppedCount;
              return (
                <Pressable
                  key={f.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text
                    style={[styles.chipLabel, active && styles.chipLabelActive]}
                  >
                    {f.label}
                  </Text>
                  <Text style={styles.chipCount}>{count}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {error && !refreshing ? (
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
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load('refresh')}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name={containers.length > 0 ? 'search-outline' : 'server-outline'}
                size={46}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {containers.length > 0 ? 'Aucun résultat' : 'Aucun conteneur'}
              </Text>
              <Text style={styles.emptyText}>
                {containers.length > 0
                  ? 'Aucun conteneur ne correspond à la recherche ou au filtre actif.'
                  : 'Le bridge a répondu mais ne renvoie aucun conteneur.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ContainerCard
              container={item}
              pending={pending?.id === item.id ? pending.action : null}
              onAction={handleAction}
              onPress={() =>
                router.push({ pathname: '/container/[id]', params: { id: item.id } })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

