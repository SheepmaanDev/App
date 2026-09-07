import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogViewer } from '@/components/log-viewer';
import { StatsGrid } from '@/components/stats-grid';
import { StatusBadge } from '@/components/status-badge';
import { useBridgeConfigured, useBridgeStore } from '@/stores/use-bridge-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { ContainerAction, ContainerDetail, ContainerStats } from '@/types';
import { confirmDialog, showError } from '@/utils/confirm';

const STATS_INTERVAL_MS = 3000;

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
        pressed && styles.pressed
      ]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <Ionicons name={icon} size={15} color={accent} />
      )}
      <Text style={[styles.actionLabel, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Ecran detail d'un conteneur : informations, stats (polling 3 s),
 * actions de cycle de vie et console de logs temps réel (WebSocket).
 */
export default function ContainerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const configured = useBridgeConfigured();
  const getClient = useBridgeStore((state) => state.getClient);

  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ContainerAction | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await getClient().getContainer(id);
      setDetail(data.container);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [getClient, id, reloadKey]);

  useEffect(() => {
    if (configured) void load();
    else setLoading(false);
  }, [configured, load]);

  const running = detail?.state === 'running';

  // Stats : polling leger tant que le conteneur tourne, sinon remise a zero.
  useEffect(() => {
    if (!id || !configured) return;
    if (!running) {
      setStats(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await getClient().getContainerStats(id);
        if (!cancelled) setStats(data.stats);
      } catch {
        if (!cancelled) setStats(null);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), STATS_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, configured, running, getClient, reloadKey]);

  const name = (detail?.name ?? id ?? '').replace(/^\//, '');

  const handleAction = useCallback(
    async (action: ContainerAction) => {
      if (!id) return;
      if (action === 'stop') {
        const ok = await confirmDialog(
          `Arrêter « ${name} » ?`,
          'Le conteneur va être arrêté. Cette action peut interrompre des services.'
        );
        if (!ok) return;
      }
      setPending(action);
      try {
        await getClient()[action](id);
        await load();
      } catch (err) {
        showError('Action impossible', err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setPending(null);
      }
    },
    [getClient, id, load, name]
  );

  if (!id) return null;

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="settings-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Pont non configuré</Text>
          <Text style={styles.emptyText}>
            Renseigne l'adresse du bridge et ton jeton dans les réglages.
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
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={46} color={colors.danger} />
          <Text style={styles.emptyTitle}>Impossible d'afficher le conteneur</Text>
          <Text style={styles.emptyText}>{error ?? 'Conteneur introuvable.'}</Text>
          <View style={styles.retryRow}>
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
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
              onPress={() => router.back()}
            >
              <Text style={styles.ghostButtonLabel}>Retour</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTexts}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {detail.image}
          </Text>
        </View>
        <StatusBadge state={detail.state} />
      </View>

      <ScrollView
        contentContainerStyle={styles.infoContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Statut</Text>
          <Text style={styles.metaValue}>{detail.status}</Text>
        </View>

        <View style={styles.portsRow}>
          {detail.ports.length > 0 ? (
            detail.ports.map((port, index) => (
              <Text key={`${port.containerPort}-${index}`} style={styles.port}>
                {port.containerPort}
                {port.hostPort && port.hostPort !== port.containerPort
                  ? ` → ${port.hostPort}`
                  : ''}
                {port.protocol ? `/${port.protocol}` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.noPorts}>aucun port exposé</Text>
          )}
        </View>

        <StatsGrid stats={stats} />

        <View style={styles.actionsRow}>
          {running ? (
            <>
              <ActionButton
                icon="refresh"
                label="Restart"
                color={colors.info}
                pending={pending === 'restart'}
                onPress={() => void handleAction('restart')}
              />
              <ActionButton
                icon="stop"
                label="Stop"
                color={colors.danger}
                pending={pending === 'stop'}
                onPress={() => void handleAction('stop')}
              />
            </>
          ) : (
            <ActionButton
              icon="play"
              label="Start"
              color={colors.accent}
              pending={pending === 'start'}
              onPress={() => void handleAction('start')}
            />
          )}
        </View>
      </ScrollView>

      <LogViewer id={id} />
    </SafeAreaView>
  );
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
  ghostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm
  },
  ghostButtonLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  pressed: {
    opacity: 0.6
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  headerTexts: {
    flex: 1,
    flexShrink: 1,
    gap: 2
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.mono
  },
  infoContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  metaRow: {
    gap: 2
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  metaValue: {
    color: colors.textSecondary,
    fontSize: 13
  },
  portsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  port: {
    color: colors.info,
    fontFamily: fonts.mono,
    fontSize: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  noPorts: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic'
  },
  actionsRow: {
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
  actionLabel: {
    fontSize: 12,
    fontWeight: '600'
  }
});