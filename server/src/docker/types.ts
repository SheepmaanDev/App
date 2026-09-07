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

export interface LogStreamOptions {
  /** Nombre de lignes d'historique a renvoyer d'abord. */
  tail?: number;
  /** Continue a emettre les nouvelles lignes apres l'historique. */
  follow: boolean;
  onLine: (line: string) => void;
  /** Appele en cas d'erreur asynchrone (ex. conteneur introuvable). */
  onError?: (error: Error) => void;
}

export interface LogStreamHandle {
  close(): void;
}

export interface DockerClient {
  listContainers(all?: boolean): Promise<ContainerSummary[]>;
  getContainer(idOrName: string): Promise<ContainerDetail | null>;
  startContainer(idOrName: string): Promise<void>;
  stopContainer(idOrName: string): Promise<void>;
  restartContainer(idOrName: string): Promise<void>;
  systemInfo(): Promise<SystemInfo>;
  getContainerLogs(idOrName: string, tail?: number): Promise<string[]>;
  streamContainerLogs(idOrName: string, options: LogStreamOptions): LogStreamHandle;
  getContainerStats(idOrName: string): Promise<ContainerStats>;
}

/** Erreur levee quand un conteneur (id ou nom( est introuvable. */
export class DockerNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(readonly idOrName: string) {
    super(`Conteneur introuvable : ${idOrName}`);
    this.name = 'DockerNotFoundError';
  }
}