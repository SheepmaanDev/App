import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createSshStream,
  stripAnsi,
  type SshStreamHandle,
  type SshStreamStatus
} from '@/api/bridge-client';
import { ScreenHeader } from '@/components/screen-header';
import { useBridgeConfigured, useBridgeStore } from '@/stores/use-bridge-store';
import { colors, fonts, radius, spacing } from '@/theme';

const MAX_LINES = 2000;

interface SshLine {
  id: number;
  text: string;
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'déconnecté',
  connecting: 'connexion SSH…',
  connected: 'connecté',
  error: 'erreur',
  unauthorized: 'token refusé',
  closed: 'déconnecté'
};

const STATUS_COLORS: Record<string, string> = {
  idle: colors.textMuted,
  connecting: colors.warning,
  connected: colors.accent,
  error: colors.danger,
  unauthorized: colors.danger,
  closed: colors.textMuted
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  body: {
    flex: 1
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
  form: {
    padding: spacing.lg,
    gap: spacing.md
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    fontFamily: fonts.mono
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  formError: {
    color: colors.danger,
    fontSize: 13
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1
  },
  reconnect: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3
  },
  reconnectText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600'
  },
  terminal: {
    flex: 1,
    backgroundColor: '#0D1117'
  },
  line: {
    color: '#B7C2D0',
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16
  },
  listContent: {
    padding: spacing.md
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  prompt: {
    color: colors.accent,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700'
  },
  commandInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 13,
    paddingVertical: spacing.xs
  },
  runButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  runDisabled: {
    backgroundColor: colors.surfaceAlt
  }
});

export default function SshScreen() {
  const router = useRouter();
  const configured = useBridgeConfigured();
  const baseUrl = useBridgeStore((state) => state.baseUrl);
  const token = useBridgeStore((state) => state.token);
  const sshUser = useBridgeStore((state) => state.sshUser);
  const sshPassword = useBridgeStore((state) => state.sshPassword);
  const sshPort = useBridgeStore((state) => state.sshPort);
  const setSshCreds = useBridgeStore((state) => state.setSshCreds);

  const hostLabel = baseUrl.replace(/^https?:\/\//, '');

  const [lines, setLines] = useState<SshLine[]>([]);
  const [status, setStatus] = useState<SshStreamStatus>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [showForm, setShowForm] = useState(!(sshUser && sshPassword));
  const [userField, setUserField] = useState(sshUser);
  const [passwordField, setPasswordField] = useState(sshPassword);
  const [portField, setPortField] = useState(String(sshPort));
  const [formError, setFormError] = useState('');
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRef = useRef<SshStreamHandle | null>(null);
  const pending = useRef('');

  const appendLine = useCallback((text: string) => {
    setLines((prev) => {
      const id = (prev.length > 0 ? prev[prev.length - 1].id : 0) + 1;
      const next = [...prev, { id, text }];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }, []);

  /** Decoupe un chunk en lignes (le dernier morceau partiel est retenu). */
  const appendOutput = useCallback(
    (chunk: string) => {
      const clean = stripAnsi(chunk).replace(/\r/g, '');
      const parts = (pending.current + clean).split('\n');
      pending.current = parts.pop() ?? '';
      const ready = parts.filter((p) => p.trim() !== '');
      for (const line of ready) appendLine(line);
    },
    [appendLine]
  );

  const connect = useCallback(() => {
    if (!sshUser || !sshPassword) {
      setShowForm(true);
      return;
    }
    handleRef.current?.close();
    setLines([]);
    pending.current = '';
    setStatus('connecting');
    setStatusMsg('');
    handleRef.current = createSshStream(
      baseUrl,
      token,
      { user: sshUser, password: sshPassword, port: sshPort },
      {
        onStatus: (s, message) => {
          setStatus(s);
          setStatusMsg(message ?? '');
        },
        onData: appendOutput,
        onDone: (code) => {
          setRunning(false);
          appendLine(`— terminé (code ${code ?? '?'})`);
        }
      }
    );
  }, [baseUrl, token, sshUser, sshPassword, sshPort, appendOutput, appendLine]);

  // Connexion auto a l'entree et a chaque "Reconnecter".
  useEffect(() => {
    if (!configured) return;
    if (!showForm) connect();
    return () => handleRef.current?.close();
  }, [configured, showForm, connect, reloadKey]);

  const submitForm = useCallback(() => {
    const user = userField.trim();
    const password = passwordField;
    const port = Number(portField) || 22;
    if (!user || !password) {
      setFormError('Utilisateur et mot de passe requis.');
      return;
    }
    if (!(port > 0 && port < 65536)) {
      setFormError('Port invalide.');
      return;
    }
    setFormError('');
    setSshCreds(user, password, port);
    setShowForm(false);
  }, [userField, passwordField, portField, setSshCreds]);

  const runCommand = useCallback(() => {
    const cmd = input.trim();
    if (!cmd || running || status !== 'connected') return;
    appendLine(`$ ${cmd}`);
    setInput('');
    setRunning(true);
    handleRef.current?.run(cmd);
  }, [input, running, status, appendLine]);

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader
          left={
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          }
          title="Terminal SSH"
        />
        <View style={styles.center}>
          <Ionicons name="terminal-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Pont non configuré</Text>
          <Text style={styles.emptyText}>
            Renseigne l'adresse du bridge et ton jeton dans les réglages avant
            d'utiliser le terminal.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const streamDown =
    status === 'error' || status === 'unauthorized' || status === 'closed';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        left={
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        }
        title="Terminal SSH"
        subtitle={
          status === 'connected'
            ? `${sshUser}@${hostLabel}:${sshPort}`
            : STATUS_LABELS[status] ?? 'déconnecté'
        }
        right={
          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            onPress={() => setLines([])}
            disabled={lines.length === 0}
            hitSlop={8}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={lines.length > 0 ? colors.textSecondary : colors.textMuted}
            />
          </Pressable>
        }
      />

      {status === 'connecting' ? (
        <View style={styles.banner}>
          <View style={[styles.bannerDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.bannerText, { color: colors.warning }]}>
            Connexion SSH à {hostLabel}…
          </Text>
        </View>
      ) : null}

      {streamDown ? (
        <View style={styles.banner}>
          <View style={[styles.bannerDot, { backgroundColor: colors.danger }]} />
          <Text
            style={[styles.bannerText, { color: colors.danger }]}
            numberOfLines={2}
          >
            {`${STATUS_LABELS[status] ?? 'erreur'}${statusMsg ? ` — ${statusMsg}` : ''}`}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.reconnect, pressed && styles.pressed]}
            onPress={() => setReloadKey((k) => k + 1)}
            hitSlop={6}
          >
            <Ionicons name="refresh" size={13} color={colors.accent} />
            <Text style={styles.reconnectText}>Reconnecter</Text>
          </Pressable>
        </View>
      ) : null}

      {showForm ? (
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.formCard}>
            <Text style={styles.label}>Utilisateur SSH</Text>
            <TextInput
              style={styles.input}
              value={userField}
              onChangeText={setUserField}
              placeholder="qmouton"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={passwordField}
              onChangeText={setPasswordField}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              value={portField}
              onChangeText={setPortField}
              keyboardType="number-pad"
            />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={submitForm}
            >
              <Ionicons name="terminal-outline" size={16} color={colors.background} />
              <Text style={styles.primaryButtonLabel}>Se connecter</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Les identifiants sont stockés uniquement sur ton téléphone
            (SecureStore) et transmis au bridge via le VPN. Sans PTY :
            privilégie les commandes simples (systemctl, df, docker ps…) — les
            interfaces TUI (htop, nano) ne se rendent pas dans ce terminal.
          </Text>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={[...lines].reverse()}
            inverted
            keyExtractor={(item) => String(item.id)}
            style={styles.terminal}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <Text style={styles.line}>{item.text}</Text>}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {status === 'connected'
                    ? 'Connecté. Tape une commande en bas.'
                    : 'En attente de connexion…'}
                </Text>
              </View>
            }
          />
          <View style={styles.inputRow}>
            <Text style={styles.prompt}>$</Text>
            <TextInput
              style={styles.commandInput}
              value={input}
              onChangeText={setInput}
              placeholder="commande…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              editable={status === 'connected'}
              onSubmitEditing={runCommand}
              returnKeyType="send"
            />
            <Pressable
              style={[
                styles.runButton,
                (running || status !== 'connected') && styles.runDisabled
              ]}
              onPress={runCommand}
              disabled={running || status !== 'connected'}
            >
              {running ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Ionicons name="play" size={16} color={colors.background} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
