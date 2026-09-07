import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '@/theme';

interface WebViewProps {
  source: { uri: string };
  style?: object;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  startInLoadingState?: boolean;
  renderLoading?: () => ReactNode;
  onLoadEnd?: () => void;
  onError?: () => void;
}

// react-native-webview n'a pas d'implementation web : le composant n'est
// charge QUE sur natif. Sur web, le service s'ouvre dans le navigateur.
declare const require: (name: string) => { WebView: ComponentType<WebViewProps> };
let WebView: ComponentType<WebViewProps> | null = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  headerTexts: {
    flex: 1,
    gap: 1
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  headerUrl: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono
  },
  web: {
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
  errorBanner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  errorBannerText: {
    color: colors.text,
    fontSize: 13,
    flex: 1
  },
  pressed: {
    opacity: 0.6
  }
});

export default function ServiceViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; url?: string }>();

  const name = typeof params.name === 'string' ? params.name : 'Service';
  const url = typeof params.url === 'string' ? params.url : '';
  const urlValid = /^https?:\/\//i.test(url);

  const [reloadKey, setReloadKey] = useState(0);
  const [pageError, setPageError] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  const reload = () => {
    setPageError(false);
    setLoadingPage(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTexts}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          {url ? (
            <Text style={styles.headerUrl} numberOfLines={1}>
              {url}
            </Text>
          ) : null}
        </View>
        {urlValid ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              onPress={reload}
              hitSlop={8}
            >
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              onPress={() => void Linking.openURL(url)}
              hitSlop={8}
            >
              <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : null}
      </View>

      {!urlValid ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={46} color={colors.warning} />
          <Text style={styles.emptyTitle}>URL invalide</Text>
          <Text style={styles.emptyText}>
            Ce service n'a pas d'adresse valide (http/https). Verifie le champ
            url dans services.yaml.
          </Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <View style={styles.center}>
          <Ionicons name="globe-outline" size={46} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Ouverture navigateur</Text>
          <Text style={styles.emptyText}>
            Sur le web, {name} s'ouvre dans un onglet du navigateur plutot
            qu'en vue integree.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => void Linking.openURL(url)}
          >
            <Ionicons name="open-outline" size={16} color={colors.background} />
            <Text style={styles.primaryButtonLabel}>Ouvrir {name}</Text>
          </Pressable>
        </View>
      ) : WebView ? (
        <View style={styles.web}>
          <WebView
            key={reloadKey}
            source={{ uri: url }}
            style={styles.web}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}
            onLoadEnd={() => setLoadingPage(false)}
            onError={() => setPageError(true)}
          />
          {loadingPage && !pageError ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : null}
          {pageError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} />
              <Text style={styles.errorBannerText}>
                Page injoignable. Verifie que tu es sur le meme reseau que
                l'hebergeur, ou que le service tourne.
              </Text>
              <Pressable onPress={reload} hitSlop={8}>
                <Ionicons name="refresh" size={20} color={colors.text} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyText}>WebView indisponible.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
