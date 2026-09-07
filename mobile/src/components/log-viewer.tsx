import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createLogStream,
  type LogStreamStatus
} from '@/api/bridge-client';
import { useBridgeStore } from '@/stores/use-bridge-store';
import { colors, fonts, radius, spacing } from '@/theme';

const MAX_LINES = 1000;

const STATUS_LABELS: Record<LogStreamStatus, string> = {
  connecting: 'connexion…',
  live: 'en direct',
  closed: 'déconnecté',
  error: 'erreur de connexion',
  unauthorized: 'token refusé',
  not_found: 'conteneur introuvable'
};

const STATUS_COLORS: Record<LogStreamStatus, string> = {
  connecting: colors.warning,
  live: colors.accent,
  closed: colors.textMuted,
  error: colors.danger,
  unauthorized: colors.danger,
  not_found: colors.danger
};

interface LogLine {
  id: number;
  text: string;
}

/**
 * Console de logs temps réel d'un conteneur.
 * - historique (200 lignes) puis flux live via WebSocket du bridge
 * - liste inversee : reste collée au bas, les nouvelles lignes apparaissent en bas
 * - bouton « Reconnecter » si le flux tombe
 */
export function LogViewer({ id }: { id: string }) {
  const baseUrl = useBridgeStore((state) => state.baseUrl);
  const token = useBridgeStore((state) => state.token);

  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<LogStreamStatus>('connecting');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!baseUrl || !token) return;
    setLines([]);
    setStatus('connecting');

    const handle = createLogStream(baseUrl, token, id, {
      onLine: (text) => {
        // L'id est derive du dernier element de la liste : strictement
        // croissant par construction, donc jamais deux fois le meme —
        // meme si un ancien flux livre encore des messages apres un reset.
        setLines((prev) => {
          const id = (prev.length > 0 ? prev[prev.length - 1].id : 0) + 1;
          const next = [...prev, { id, text }];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      },
      onStatus: setStatus
    });
    return () => handle.close();
  }, [id, baseUrl, token, reloadKey]);

  // Liste inversee : data[0] (la ligne la plus recente) s'affiche en bas.
  const data = useMemo(() => [...lines].reverse(), [lines]);

  const streamDown =
    status === 'closed' || status === 'error' || status === 'unauthorized';

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }]} />
        <Text style={[styles.status, { color: STATUS_COLORS[status] }]}>
          {STATUS_LABELS[status]}
        </Text>
        <Text style={styles.count}>{lines.length} lignes</Text>
        {streamDown ? (
          <Pressable
            style={({ pressed }) => [styles.reconnect, pressed && styles.pressed]}
            onPress={() => setReloadKey((k) => k + 1)}
            hitSlop={6}
          >
            <Ionicons name="refresh" size={13} color={colors.accent} />
            <Text style={styles.reconnectText}>Reconnecter</Text>
          </Pressable>
        ) : null}
      </View>

      {data.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {status === 'connecting'
              ? 'Ouverture du flux de logs…'
              : 'Aucun log reçu pour le moment.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          inverted
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <Text style={styles.line}>{item.text}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  status: {
    fontSize: 12,
    fontWeight: '700'
  },
  count: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 'auto',
    fontFamily: fonts.mono
  },
  reconnect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm
  },
  reconnectText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.6
  },
  list: {
    flex: 1
  },
  listContent: {
    padding: spacing.md
  },
  line: {
    color: '#B7C2D0',
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center'
  }
});