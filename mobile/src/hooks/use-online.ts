import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Etat de connexion reseau de l'appareil (NetInfo, fonctionne aussi sur web
 * via navigator.onLine). Vrai tant qu'aucune coupure n'est detectee.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);
  return online;
}