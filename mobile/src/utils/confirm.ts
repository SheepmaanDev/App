import { Alert, Platform } from 'react-native';

/**
 * Boite de dialogue de confirmation fonctionnant sur mobile (Alert natif)
 * et sur le web (window.confirm, car Alert est un no-op sur react-native-web).
 */
export function confirmDialog(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(true);
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmer', style: 'destructive', onPress: () => resolve(true) }
    ]);
  });
}

/** Affiche une simple alerte (fonctionne aussi sur le web). */
export function showError(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}