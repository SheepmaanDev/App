import {
  DockerNotFoundError,
  type ContainerDetail,
  type ContainerStats,
  type ContainerSummary,
  type DockerClient,
  type LogStreamHandle,
  type LogStreamOptions
} from './types.js';

interface MockEntry extends ContainerDetail {}

const SEED: MockEntry[] = [
  {
    id: '1a2b3c4d5e6f',
    name: '/portainer',
    image: 'portainer/portainer-ce:2.21.5',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-20T08:12:00.000Z',
    ports: [{ containerPort: 9000, hostPort: 9000, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T08:12:00.000Z'
  },
  {
    id: '2b3c4d5e6f70',
    name: '/jellyfin',
    image: 'lscr.io/linuxserver/jellyfin:latest',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-20T09:00:00.000Z',
    ports: [
      { containerPort: 8096, hostPort: 8096, protocol: 'tcp' },
      { containerPort: 8920, hostPort: 8920, protocol: 'tcp' }
    ],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 1,
    startedAt: '2026-08-28T09:00:00.000Z'
  },
  {
    id: '3c4d5e6f7081',
    name: '/grafana',
    image: 'grafana/grafana:11.4.0',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-20T10:30:00.000Z',
    ports: [{ containerPort: 3000, hostPort: 3000, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T10:30:00.000Z'
  },
  {
    id: '4d5e6f708192',
    name: '/home-assistant',
    image: 'ghcr.io/home-assistant/home-assistant:2026.9',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-21T07:45:00.000Z',
    ports: [{ containerPort: 8123, hostPort: 8123, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 2,
    startedAt: '2026-08-28T07:45:00.000Z'
  },
  {
    id: '5e6f708192a3',
    name: '/n8n',
    image: 'n8nio/n8n:1.80.0',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-22T11:00:00.000Z',
    ports: [{ containerPort: 5678, hostPort: 5678, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T11:00:00.000Z'
  },
  {
    id: '6f708192a3b4',
    name: '/postgres',
    image: 'postgres:16-alpine',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-22T12:15:00.000Z',
    ports: [{ containerPort: 5432, hostPort: 5432, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T12:15:00.000Z'
  },
  {
    id: '7a8b9c0d1e2f',
    name: '/traefik',
    image: 'traefik:v3.4',
    state: 'running',
    status: 'Up 3 days',
    createdAt: '2026-08-19T09:30:00.000Z',
    ports: [
      { containerPort: 80, hostPort: 80, protocol: 'tcp' },
      { containerPort: 443, hostPort: 443, protocol: 'tcp' },
      { containerPort: 8080, hostPort: 8080, protocol: 'tcp' }
    ],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T09:30:00.000Z'
  },
  {
    id: '8b9c0d1e2f30',
    name: '/vaultwarden',
    image: 'vaultwarden/server:1.32.5',
    state: 'exited',
    status: 'Exited (0) 2 hours ago',
    createdAt: '2026-08-23T14:20:00.000Z',
    ports: [{ containerPort: 8088, hostPort: 8088, protocol: 'tcp' }],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0
  },
  {
    id: '9c0d1e2f3041',
    name: '/watchtower',
    image: 'containrrr/watchtower:1.7.1',
    state: 'paused',
    status: 'Up 3 days (Paused)',
    createdAt: '2026-08-19T20:00:00.000Z',
    ports: [],
    labels: { 'com.docker.compose.project': 'homelab' },
    restartCount: 0,
    startedAt: '2026-08-28T20:00:00.000Z'
  }
];
const clone = (entry: MockEntry): ContainerDetail => ({
  ...entry,
  ports: entry.ports.map((p) => ({ ...p })),
  labels: { ...entry.labels },
  config: entry.config ? { ...entry.config } : undefined
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Petit hash stable pour deriver des valeurs deterministes par conteneur. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const LOG_POOL = [
  'Configuration chargee avec succes',
  'Nouvelle connexion entrante',
  'Requete traitee en 42ms',
  'Verification de la sante du service',
  'Cache mis a jour',
  'Sauvegarde incrementale terminee',
  'Tache planifiee executee',
  'Nettoyage des fichiers temporaires',
  'Reponse envoyee (204 No Content)',
  'Erreur reseau temporaire, nouvelle tentative dans 2s',
  'Utilisateur authentifie avec succes',
  'Taille du buffer ajustee',
  'Rendu de la page termine',
  'Synchronisation avec le registre OK',
  'Connexion au stockage etablie'
];

const LOG_ERRORS = [
  'Impossible de joindre le service en amont (timeout)',
  'Quota disque depasse pour ce volume',
  'Tentative d\u2019acces non autorisee rejetee'
];

function mockLogLine(entry: MockEntry, index: number, now: number): string {
  const ts = new Date(now).toISOString();
  const pool = index % 17 === 0 ? LOG_ERRORS : LOG_POOL;
  const msg = pool[index % pool.length];
  const level =
    index % 17 === 0 ? 'ERROR' : index % 5 === 0 ? 'WARN' : 'INFO';
  return `${ts} [${level}] ${entry.name.replace(/^\//, '')}: ${msg}`;
}

function generateMockLogs(
  entry: MockEntry,
  count: number,
  now = Date.now()
): string[] {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(mockLogLine(entry, i, now - (count - i) * 2000));
  }
  return lines;
}

function mockStats(entry: MockEntry): ContainerStats {
  const seed = hashString(entry.id);
  const base = seed % 100;
  const running = entry.state === 'running';
  return {
    read: new Date().toISOString(),
    cpuPercent: running ? Number((1.2 + (base % 30) + Math.random() * 6).toFixed(2)) : 0,
    memUsage: running ? 96_000_000 + (seed % 700) * 1_000_000 : 8_000_000,
    memLimit: 1_073_741_824,
    memPercent: running
      ? Number((((96_000_000 + (seed % 700) * 1_000_000) / 1_073_741_824) * 100).toFixed(2))
      : 0,
    netRxBytes: running ? 1_200_000_000 + (seed % 500_000) : 0,
    netTxBytes: running ? 340_000_000 + (seed % 120_000) : 0,
    blockReadBytes: 4_000_000 + (seed % 900_000),
    blockWriteBytes: 900_000 + (seed % 300_000),
    pids: running ? 12 + (seed % 60) : 0
  };
}

/**
 * Client Docker simule pour le developpement local (Windows notamment).
 * Reproduit liste/inspection/demarrage/arret/redemarrage sans socket Docker.
 */
export function createMockClient(): DockerClient {
  const entries: MockEntry[] = SEED.map(clone);

  const findEntry = (idOrName: string): MockEntry => {
    const wanted = idOrName.replace(/^\//, '');
    const entry = entries.find(
      (e) => e.id === wanted || e.name.replace(/^\//, '') === wanted
    );
    if (!entry) throw new DockerNotFoundError(idOrName);
    return entry;
  };

  const toSummary = (entry: MockEntry): ContainerSummary => ({
    id: entry.id,
    name: entry.name,
    image: entry.image,
    state: entry.state,
    status: entry.status,
    createdAt: entry.createdAt,
    ports: entry.ports,
    labels: entry.labels
  });

  return {
    async listContainers(all = true) {
      await delay(30);
      return entries.filter((e) => all || e.state === 'running').map(toSummary);
    },

    async getContainer(idOrName) {
      await delay(20);
      try {
        return clone(findEntry(idOrName));
      } catch (error) {
        if (error instanceof DockerNotFoundError) return null;
        throw error;
      }
    },

    async startContainer(idOrName) {
      await delay(150);
      const entry = findEntry(idOrName);
      entry.state = 'running';
      entry.status = 'Up Just now';
      entry.startedAt = new Date().toISOString();
    },

    async stopContainer(idOrName) {
      await delay(150);
      const entry = findEntry(idOrName);
      entry.state = 'exited';
      entry.status = 'Exited (0) Just now';
    },

    async restartContainer(idOrName) {
      await delay(200);
      const entry = findEntry(idOrName);
      entry.state = 'running';
      entry.status = 'Up Just now';
      entry.startedAt = new Date().toISOString();
    },

    async systemInfo() {
      const total = entries.length;
      const running = entries.filter((e) => e.state === 'running').length;
      const paused = entries.filter((e) => e.state === 'paused').length;
      return {
        engine: 'mock' as const,
        version: '27.5.1+azure-3',
        apiVersion: '1.49',
        name: 'homelab',
        os: 'linux',
        kernel: '6.8.0-45-generic',
        architecture: 'x86_64',
        driver: 'overlay2',
        containers: {
          total,
          running,
          paused,
          stopped: total - running - paused
        }
      };
    },

    async getContainerLogs(idOrName, tail = 200) {
      await delay(25);
      const entry = findEntry(idOrName);
      const count = Math.max(1, Math.min(1000, Math.floor(tail)));
      return generateMockLogs(entry, count);
    },

    streamContainerLogs(idOrName, options: LogStreamOptions): LogStreamHandle {
      const entry = findEntry(idOrName);
      const history = generateMockLogs(entry, Math.max(1, options.tail ?? 200));
      history.forEach(options.onLine);

      let closed = false;
      let timer: NodeJS.Timeout | null = null;
      let index = history.length;

      const emitNext = () => {
        if (closed) return;
        options.onLine(mockLogLine(entry, index++, Date.now()));
        timer = setTimeout(emitNext, 1500 + Math.random() * 2500);
      };

      if (options.follow) timer = setTimeout(emitNext, 800);

      return {
        close() {
          closed = true;
          if (timer) clearTimeout(timer);
        }
      };
    },

    async getContainerStats(idOrName) {
      await delay(30);
      const entry = findEntry(idOrName);
      return mockStats(entry);
    }
  };
}