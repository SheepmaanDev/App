import type {
  ContainerAction,
  ContainerDetail,
  ContainerState,
  ContainerStats,
  ContainerSummary,
  HealthInfo,
  HostMetricsResponse,
  ServicesResponse,
  SystemInfo
} from '@/types';

export type BridgeErrorKind =
  | 'network'
  | 'unauthorized'
  | 'not_found'
  | 'http'
  | 'invalid';

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly kind: BridgeErrorKind
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

/** Normalise une URL de bridge : ajoute http:// si absent, retire le '/' final. */
function normalizeBaseUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) throw new BridgeError("L'URL du bridge est vide.", 'invalid');
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `http://${cleaned}`;
  if (cleaned.length > 2048) throw new BridgeError('URL du bridge trop longue.', 'invalid');
  return cleaned;
}

/**
 * Client HTTP du pont homelab-bridge.
 * Toutes les requetes (sauf /health) sont authentifiees avec un Bearer token.
 */
export class BridgeClient {
  readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token.trim();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 10_000
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {};
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
      } catch {
        throw new BridgeError(
          'Impossible de joindre le bridge. Vérifie l\u2019URL et que le serveur est bien lancé.',
          'network'
        );
      }

      if (response.status === 401) {
        throw new BridgeError(
          'Token refusé (401). Vérifie le jeton dans les réglages.',
          'unauthorized'
        );
      }
      if (response.status === 404) {
        throw new BridgeError('Ressource introuvable (404).', 'not_found');
      }
      if (!response.ok) {
        // Si le serveur renvoie un message { error }, on l'affiche tel quel.
        let detail = '';
        try {
          const body = (await response.json()) as { error?: string };
          if (typeof body?.error === 'string') detail = body.error;
        } catch {
          // corps non JSON
        }
        throw new BridgeError(
          detail || `Erreur du serveur (HTTP ${response.status}).`,
          'http'
        );
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  health() {
    return this.request<HealthInfo>('GET', '/health');
  }

  systemInfo() {
    return this.request<{ info: SystemInfo }>('GET', '/system/info');
  }

  listContainers(all = true) {
    return this.request<{ containers: ContainerSummary[]; count: number }>(
      'GET',
      `/containers?all=${all}`
    );
  }

  getContainer(id: string) {
    return this.request<{ container: ContainerDetail }>(
      'GET',
      `/containers/${encodeURIComponent(id)}`
    );
  }

  /** Historique des logs (REST). Le temps reel passe par createLogStream(). */
  getContainerLogs(id: string, tail = 200) {
    return this.request<{ container: string; tail: number; logs: string[] }>(
      'GET',
      `/containers/${encodeURIComponent(id)}/logs?tail=${tail}`
    );
  }

  /** Instantane CPU / RAM / reseau d'un conteneur. */
  getContainerStats(id: string) {
    return this.request<{ container: string; stats: ContainerStats }>(
      'GET',
      `/containers/${encodeURIComponent(id)}/stats`
    );
  }

  /** Annuaire des services web du homelab (services.yaml cote bridge). */
  listServices() {
    return this.request<ServicesResponse>('GET', '/services');
  }

  /** Metriques de la machine hote (CPU, RAM, disques, reseau...). */
  getHostMetrics() {
    return this.request<HostMetricsResponse>('GET', '/host/metrics');
  }

  /** Redemarre la machine hote (double confirmation cote app). */
  rebootHost() {
    return this.request<{ ok: boolean; action: string }>(
      'POST',
      '/host/reboot'
    );
  }

  start(id: string) {
    return this.action(id, 'start');
  }

  stop(id: string) {
    return this.action(id, 'stop');
  }

  restart(id: string) {
    return this.action(id, 'restart');
  }

  private action(id: string, action: ContainerAction) {
    return this.request<{
      ok: boolean;
      action: ContainerAction;
      id: string;
      state: ContainerState;
    }>('POST', `/containers/${encodeURIComponent(id)}/${action}`);
  }
}

export type LogStreamStatus =
  | 'connecting'
  | 'live'
  | 'closed'
  | 'error'
  | 'unauthorized'
  | 'not_found';

export interface LogStreamHandlers {
  onLine: (line: string) => void;
  onStatus: (status: LogStreamStatus) => void;
}

export interface LogStreamHandle {
  close(): void;
}

/**
 * Ouvre le flux WebSocket des logs d'un conteneur (/containers/:id/logs/stream).
 * L'authentification se fait par un message { type: 'auth', token } apres
 * l'ouverture : compatible React Native, qui n'envoie pas de headers custom.
 */
export function createLogStream(
  baseUrl: string,
  token: string,
  id: string,
  handlers: LogStreamHandlers
): LogStreamHandle {
  let ws: WebSocket | null = null;
  let closedByUser = false;
  let receivedAny = false;

  let wsUrl: string;
  try {
    const normalized = normalizeBaseUrl(baseUrl);
    wsUrl = `${normalized.replace(/^http/i, 'ws')}/containers/${encodeURIComponent(id)}/logs/stream`;
  } catch {
    handlers.onStatus('error');
    return { close() {} };
  }

  try {
    ws = new WebSocket(wsUrl);
  } catch {
    handlers.onStatus('error');
    return { close() {} };
  }

  ws.onopen = () => {
    ws?.send(JSON.stringify({ type: 'auth', token: token.trim() }));
  };

  ws.onmessage = (event) => {
    // Messages "zombies" : ignores si le flux a ete ferme par l'utilisateur
    // (un ancien WebSocket peut encore livrer des evenements apres close()).
    if (closedByUser) return;
    receivedAny = true;
    handlers.onStatus('live');
    const data = event.data;
    if (typeof data === 'string' && data.length > 0) {
      handlers.onLine(data.replace(/\n$/, ''));
    }
  };

  ws.onerror = () => {
    if (closedByUser) return;
    if (!receivedAny) handlers.onStatus('error');
  };

  ws.onclose = (event) => {
    if (closedByUser) return;
    if (event.code === 4401) handlers.onStatus('unauthorized');
    else if (event.code === 4404) handlers.onStatus('not_found');
    else handlers.onStatus(receivedAny ? 'closed' : 'error');
  };

  return {
    close() {
      closedByUser = true;
      try {
        ws?.close();
      } finally {
        ws = null;
      }
    }
  };
}