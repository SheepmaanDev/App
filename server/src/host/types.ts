/**
 * Metriques de la machine hote (celle qui heberge le bridge et Docker).
 * Types partages avec l'application mobile (mobile/src/types.ts).
 */

/** Informations quasi-statiques de la machine. */
export interface HostStatic {
  hostname: string;
  /** Distribution + version, ex. "Debian GNU/Linux 13". */
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

export interface HostProcessSummary {
  all: number;
  running: number;
}

export interface HostMetrics {
  uptime: number; // secondes depuis le boot
  cpu: HostCpuLoad;
  memory: HostMemory;
  disks: HostDisk[];
  network: HostNetworkIface[];
  /** Temperature CPU en °C, ou null si non disponible (lm-sensors absent). */
  temperatureC: number | null;
  processes: HostProcessSummary;
}

/**
 * Fournisseur de metriques hote — injectable dans buildApp pour les tests,
 * implementation reelle basee sur systeminformation (host/si.ts).
 */
export interface HostClient {
  staticInfo(): Promise<HostStatic>;
  metrics(): Promise<HostMetrics>;
}