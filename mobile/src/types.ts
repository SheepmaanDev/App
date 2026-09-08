/**
 * Types partages avec le pont homelab-bridge (server/src/docker/types.ts).
 */

export type ContainerState =
  | 'created'
  | 'restarting'
  | 'running'
  | 'removing'
  | 'paused'
  | 'exited'
  | 'dead';

export interface ContainerPort {
  containerPort?: number;
  hostPort?: number;
  protocol?: string;
}

export interface ContainerSummary {
  id: string;
  name: string;
  image: string;
  state: ContainerState;
  status: string;
  createdAt: string;
  ports: ContainerPort[];
  labels: Record<string, string>;
}

export interface ContainerDetail extends ContainerSummary {
  restartCount?: number;
  startedAt?: string;
  config?: {
    image?: string;
    cmd?: string[];
    entrypoint?: string[];
  };
}

export interface SystemInfo {
  engine: 'docker' | 'mock';
  version: string;
  apiVersion: string;
  name: string;
  os: string;
  kernel: string;
  architecture: string;
  driver: string;
  containers: { total: number; running: number; paused: number; stopped: number };
}

export interface HealthInfo {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export type ContainerAction = 'start' | 'stop' | 'restart';

export interface ContainerStats {
  read: string;
  cpuPercent: number;
  memUsage: number; // octets
  memLimit: number; // octets
  memPercent: number;
  netRxBytes: number;
  netTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  pids: number;
}

/** Service web du homelab (annuaire cote bridge : services.yaml). */
export interface ServiceEntry {
  name: string;
  url: string;
  description?: string;
  category?: string;
  /** Nom d'icone Ionicons. */
  icon?: string;
  /** Nom du conteneur Docker lie (etat affiche en temps reel). */
  container?: string;
}

export interface ServicesResponse {
  count: number;
  source: 'file' | 'mock' | 'empty';
  services: ServiceEntry[];
}

/** Informations quasi-statiques de la machine hote. */
export interface HostStatic {
  hostname: string;
  distro: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cores: number;
}

export interface HostCpuLoad {
  percent: number;
  load1: number;
  load5: number;
  load15: number;
}

export interface HostMemory {
  total: number; // octets
  used: number; // octets
  free: number; // octets
  percent: number;
  swapTotal: number; // octets
  swapUsed: number; // octets
}

export interface HostDisk {
  mount: string;
  total: number; // octets
  used: number; // octets
  percent: number;
}

export interface HostNetworkIface {
  name: string;
  rxRate: number; // octets/s
  txRate: number; // octets/s
  rxTotal: number; // octets depuis le boot
  txTotal: number; // octets depuis le boot
}

export interface HostMetrics {
  uptime: number; // secondes depuis le boot
  cpu: HostCpuLoad;
  memory: HostMemory;
  disks: HostDisk[];
  network: HostNetworkIface[];
  temperatureC: number | null;
  processes: { all: number; running: number };
}

export interface HostMetricsResponse {
  host: HostStatic;
  metrics: HostMetrics;
}