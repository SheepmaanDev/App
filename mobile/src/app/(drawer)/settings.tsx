import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BridgeClient, BridgeError } from '@/api/bridge-client';
import { MenuButton } from '@/components/menu-button';
import { ScreenHeader } from '@/components/screen-header';
import {
  useBridgeConfigured,
  useBridgeStore,
  type AutoRefreshInterval
} from '@/stores/use-bridge-store';
import { colors, radius, spacing } from '@/theme';
import { showError } from '@/utils/confirm';

interface TestResult {
  ok: boolean;
  message: string;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
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
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  labelSpaced: {
    marginTop: spacing.md
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md
  },
  resultText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md
  },
  buttonPrimary: {
    backgroundColor: colors.accent
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonPrimaryLabel: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14
  },
  buttonSecondaryLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14
  },
  pressed: {
    opacity: 0.6
  },
  footerNote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.md
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  chipLabelActive: {
    color: colors.accent
  }
});

export default function SettingsScreen() {
  const configured = useBridgeConfigured();
  const baseUrl = useBridgeStore((state) => state.baseUrl);
  const token = useBridgeStore((state) => state.token);
  const setConfig = useBridgeStore((state) => state.setConfig);
  const autoRefresh = useBridgeStore((state) => state.autoRefresh);
  const setAutoRefresh = useBridgeStore((state) => state.setAutoRefresh);

  const [url, setUrl] = useState(baseUrl);
  const [secret, setSecret] = useState(token);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const client = new BridgeClient(url, secret);
      const health = await client.health();
      let modeText = '';
      try {
        const { info } = await client.systemInfo();
        modeText = info.engine === 'mock' ? ' (mode mock)' : ' (Docker réel)';
      } catch {
        // Les infos system sont optionnelles pour le test de connexion
      }
      setResult({
        ok: true,
        message: `Connexion OK → ${client.baseUrl}${modeText} (v${health.version})`
      });
    } catch (error) {
      setResult({
        ok: false,
        message:
          error instanceof BridgeError ? error.message : 'Erreur inattendue.'
      });
    } finally {
      setTesting(false);
    }
  }, [url, secret]);

  const handleSave = useCallback(async () => {
    if (!url.trim()) {
      showError('Réglages', "L'URL du bridge est requise.");
      return;
    }
    setSaving(true);
    try {
      const client = new BridgeClient(url, secret);
      await client.health();
      setConfig(client.baseUrl, secret.trim());
      setSecret(secret.trim());
      setResult({ ok: true, message: 'Configuration enregistrée.' });
    } catch (error) {
      showError(
        'Impossible de sauvegarder',
        error instanceof BridgeError ? error.message : 'Erreur inattendue.'
      );
    } finally {
      setSaving(false);
    }
  }, [secret, setConfig, url]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        left={<MenuButton />}
        title="Réglages"
        subtitle="Connexion au pont homelab"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>Adresse du bridge</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.20:9999"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            IP LAN de la machine qui fait tourner homelab-bridge, avec son port
            (ex. http://192.168.1.20:9999).
          </Text>

          <Text style={[styles.label, styles.labelSpaced]}>Jeton (token)</Text>
          <TextInput
            style={styles.input}
            value={secret}
            onChangeText={setSecret}
            placeholder="dev-token"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            Le token Bearer défini via BRIDGE_TOKEN sur le serveur.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Rafraîchissement automatique</Text>
          <View style={styles.chipRow}>
            {([0, 5, 15, 30] as AutoRefreshInterval[]).map((value) => {
              const active = autoRefresh === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setAutoRefresh(value)}
                >
                  <Text
                    style={[styles.chipLabel, active && styles.chipLabelActive]}
                  >
                    {value === 0 ? 'Off' : `${value} s`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            Actualise les listes (conteneurs, services) en arrière-plan, sans
            animation ni message. Off = rafraîchissement manuel uniquement.
          </Text>
        </View>

        {result ? (
          <View
            style={[
              styles.result,
              { borderColor: result.ok ? colors.accent : colors.danger }
            ]}
          >
            <Ionicons
              name={result.ok ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={result.ok ? colors.accent : colors.danger}
            />
            <Text
              style={[
                styles.resultText,
                { color: result.ok ? colors.accent : colors.danger }
              ]}
            >
              {result.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              pressed && styles.pressed
            ]}
            onPress={() => void handleTest()}
            disabled={testing || saving}
          >
            {testing ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons name="pulse-outline" size={16} color={colors.textSecondary} />
            )}
            <Text style={styles.buttonSecondaryLabel}>Tester la connexion</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.buttonPrimary,
              pressed && styles.pressed
            ]}
            onPress={() => void handleSave()}
            disabled={testing || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <Ionicons name="save-outline" size={16} color={colors.background} />
            )}
            <Text style={styles.buttonPrimaryLabel}>Enregistrer</Text>
          </Pressable>
        </View>

        <Text style={styles.footerNote}>
          {configured
            ? 'Une configuration est déjà enregistrée sur cet appareil.'
            : 'Aucune configuration pour l’instant. Renseigne les champs puis teste et enregistre.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}