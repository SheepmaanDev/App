import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/screen-header';
import { ServiceCard } from '@/components/service-card';
import { OfflineBanner } from '@/components/offline-banner';
import { useOnline } from '@/hooks/use-online';
import { useBridgeConfigured, useBridgeStore } from '@/stores/use-bridge-store';
import { colors, spacing } from '@/theme';
import type { ContainerState, ServiceEntry } from '@/types';

type ServiceEntrySource = 'file' | 'mock' | 'empty';

const SOURCE_LABELS: Record<ServiceEntrySource, string> = {
  file: 'services.yaml',
  mock: 'exemples (mock)',
  empty: 'non configuré'
};

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
  column: {
    gap: spacing.md
  }
});

export default function ServicesScreen() {
  const router = useRouter();
  const configured = useBridgeConfigured();
  const getClient = useBridgeStore((state) => state.getClient);

  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [source, setSource] = useState<ServiceEntrySource>('empty');
  const [containerStates, setContainerStates] = useState<Record<string, ContainerState>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const online = useOnline();
  const autoRefresh = useBridgeStore((state) => state.autoRefresh);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!useBridgeStore.getState().baseUrl) return;
      if (mode === 'refresh') setRefreshing(true);
      if (mode !== 'silent') setError(null);
      try {
        const client = getClient();
        // Les conteneurs servent a afficher l'etat des services lies ;
        // si cette requete echoue, l'annuaire reste affichable.
        const [svcRes, ctrRes] = await Promise.all([
          client.listServices(),
          client.listContainers().catch(() => null)
        ]);
        setServices(svcRes.services);
        setSource(svcRes.source);
        const map: Record<string, ContainerState> = {};
        for (const c of ctrRes?.containers ?? []) {
          map[c.name.replace(/^\//, '')] = c.state;
        }
        setContainerStates(map);
        if (mode === 'silent') setError(null);
      } catch (err) {
        // Mode silencieux : on conserve l'annuaire affiche sans deranger.
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

  // Rafraichissement automatique silencieux (intervalle choisi en reglages).
  useEffect(() => {
    if (!configured || autoRefresh === 0) return;
    const id = setInterval(() => {
      void load('silent');
    }, autoRefresh * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, configured, load]);

  const openService = useCallback(
    (service: ServiceEntry) => {
      if (Platform.OS === 'web') {
        // Pas de WebView native sur web : ouverture dans un nouvel onglet.
        void Linking.openURL(service.url);
        return;
      }
      router.push({
        pathname: '/service-view',
        params: { name: service.name, url: service.url }
      });
    },
    [router]
  );

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="Services" />
        <View style={styles.center}>
          <Ionicons name="apps-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Pont non configuré</Text>
          <Text style={styles.emptyText}>
            Renseigne l'adresse du bridge et ton jeton dans les réglages pour
            retrouver tes services.
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
        <ScreenHeader title="Services" subtitle="Chargement…" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title="Services"
        subtitle={
          error
            ? 'Erreur de connexion'
            : `${services.length} service${services.length > 1 ? 's' : ''} · ${SOURCE_LABELS[source]}`
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
          data={services}
          keyExtractor={(item) => `${item.name}::${item.url}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.column}
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
              <Ionicons name="apps-outline" size={46} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucun service</Text>
              <Text style={styles.emptyText}>
                {source === 'empty'
                  ? 'Copie services.yaml.example vers server/services.yaml (ou la racine en Docker) pour remplir ton annuaire.'
                  : 'Le fichier d\u2019annuaire ne contient aucune entrée valide.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => openService(item)}
            >
              <ServiceCard
                service={item}
                state={item.container ? (containerStates[item.container] ?? null) : null}
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
