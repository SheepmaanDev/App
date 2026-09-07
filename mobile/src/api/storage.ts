import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Abstraction de stockage pour la config du bridge.
 * - natif : SecureStore (chiffre les donnees, jamais copie dans iCloud / backups)
 * - web   : localStorage (compatible react-native-web, Sprint 5)
 */
export interface BridgeStorage {
  getItem(name: string): string | null | Promise<string | null>;
  setItem(name: string, value: string): void | Promise<void>;
  removeItem(name: string): void | Promise<void>;
}

const webStorage: BridgeStorage = {
  getItem: (name) =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(name),
  setItem: (name, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name);
  }
};

const nativeStorage: BridgeStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name)
};

export const bridgeStorage: BridgeStorage =
  Platform.OS === 'web' ? webStorage : nativeStorage;