import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BridgeClient } from '@/api/bridge-client';
import { bridgeStorage } from '@/api/storage';

/** Intervalle de rafraichissement auto des listes (0 = desactive). */
export type AutoRefreshInterval = 0 | 5 | 15 | 30;

interface BridgeConfig {
  baseUrl: string;
  token: string;
}

interface BridgeStore extends BridgeConfig {
  /** Intervalle de rafraichissement auto (persiste). */
  autoRefresh: AutoRefreshInterval;
  /** Identifiants SSH pour le terminal (persistes, SecureStore natif). */
  sshUser: string;
  sshPassword: string;
  sshPort: number;
  /** Sauvegarde la config (persistee automatiquement). */
  setConfig: (baseUrl: string, token: string) => void;
  /** Change l'intervalle de rafraichissement auto. */
  setAutoRefresh: (interval: AutoRefreshInterval) => void;
  /** Enregistre les identifiants SSH du terminal. */
  setSshCreds: (user: string, password: string, port: number) => void;
  /** Construit un client pret a l'emploi avec la config courante. */
  getClient: () => BridgeClient;
}

export const useBridgeStore = create<BridgeStore>()(
  persist(
    (set, get) => ({
      baseUrl: '',
      token: '',
      autoRefresh: 0,
      sshUser: '',
      sshPassword: '',
      sshPort: 22,
      setConfig: (baseUrl, token) => set({ baseUrl, token }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
      setSshCreds: (sshUser, sshPassword, sshPort) =>
        set({ sshUser, sshPassword, sshPort }),
      getClient: () => new BridgeClient(get().baseUrl, get().token)
    }),
    {
      name: 'homelab-bridge-config',
      storage: createJSONStorage(() => bridgeStorage),
      partialize: (state) => ({
        baseUrl: state.baseUrl,
        token: state.token,
        autoRefresh: state.autoRefresh,
        sshUser: state.sshUser,
        sshPassword: state.sshPassword,
        sshPort: state.sshPort
      })
    }
  )
);

/** Vrai quand une URL et un token sont renseignes. */
export function useBridgeConfigured(): boolean {
  const baseUrl = useBridgeStore((state) => state.baseUrl);
  const token = useBridgeStore((state) => state.token);
  return baseUrl.trim().length > 0 && token.trim().length > 0;
}