import { readFile, statfs } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import si from 'systeminformation';
import type { HostClient, HostDisk, HostMetrics, HostStatic } from './types.js';

const run = promisify(exec);

/** Systemes de fichiers reels (locaux ou reseau) comptes comme disques. */
const REAL_FS = new Set([
  'ext2',
  'ext3',
  'ext4',
  'xfs',
  'btrfs',
  'f2fs',
  'zfs',
  'nfs',
  'nfs4',
  'cifs',
  'smbfs',
  'fuse.mergerfs',
  'fuse.rclone'
]);

/** Decode les escapements octaux des points de montage (ex. \040 = espace). */
function decodeMount(raw: string): string {
  return raw.replace(/\\040/g, ' ').replace(/\\011/g, '\t');
}

/**
 * Parse un contenu /proc/<pid>/mountinfo et garde les vraies partitions de
 * l'hote (peripheriques /dev/*, fs reels), dedupliquees par peripherique.
 */
export function parseHostMounts(
  content: string
): { mount: string; source: string }[] {
  const seen = new Set<string>();
  const out: { mount: string; source: string }[] = [];
  for (const line of content.split('\n')) {
    const parts = line.split(' ');
    const sep = parts.indexOf('-');
    if (sep < 0) continue;
    const fstype = parts[sep + 1] ?? '';
    const source = parts[sep + 2] ?? '';
    const mount = decodeMount(parts[4] ?? '');
    if (!REAL_FS.has(fstype)) continue;
    // Sources acceptees : peripheriques locaux (/dev/...) et montages reseau
    // NFS/CIFS (format "serveur:/chemin" ou "//serveur/chemin").
    const isRealSource =
      source.startsWith('/dev/') ||
      source.startsWith('//') ||
      /^[\w.-]+:\//.test(source);
    if (!isRealSource) continue;
    if (!mount.startsWith('/')) continue;
    if (seen.has(source)) continue;
    seen.add(source);
    out.push({ mount, source });
  }
  return out;
}

/**
 * Disques de l'hote.
 * - Dans le conteneur (HOST_FS_ROOT=/hostfs, pid:host) : /proc/1/mountinfo
 *   decrit les montages de l'hote et statfs() mesure via /hostfs/<mont>.
 * - Sinon (developpement Windows, bridge hors Docker) : systeminformation.
 */
async function diskUsage(): Promise<HostDisk[]> {
  const root = process.env.HOST_FS_ROOT;
  if (root && process.platform === 'linux') {
    try {
      const content = await readFile('/proc/1/mountinfo', 'utf8');
      const out: HostDisk[] = [];
      for (const { mount } of parseHostMounts(content)) {
        const target = mount === '/' ? root : path.join(root, mount);
        const st = await statfs(target);
        const total = st.blocks * st.bsize;
        const free = st.bavail * st.bsize;
        if (total <= 0) continue;
        const used = total - free;
        out.push({ mount, total, used, percent: (used / total) * 100 });
      }
      if (out.length > 0) return out;
    } catch {
      // /hostfs absent ou inaccessible : repli sur systeminformation.
    }
  }
  const sizes = await si.fsSize();
  return sizes
    .filter((d) => d.mount.startsWith('/') || /^[A-Za-z]:/.test(d.mount))
    .map((d) => ({
      mount: d.mount,
      total: d.size,
      used: d.used,
      percent: d.size > 0 ? (d.used / d.size) * 100 : 0
    }));
}

/** Interfaces reelles (hors loopback) — systeminformation calcule les tx/sec. */
async function networkUsage() {
  const stats = await si.networkStats();
  return stats
    .filter((n) => n.iface !== 'lo')
    .map((n) => ({
      name: n.iface,
      rxRate: Math.max(0, n.rx_sec ?? 0),
      txRate: Math.max(0, n.tx_sec ?? 0),
      rxTotal: n.rx_bytes ?? 0,
      txTotal: n.tx_bytes ?? 0
    }));
}

/**
 * Redemarre la machine hote.
 * - Dans le conteneur : via le socket D-Bus systeme de l'hote (monte en
 *   lecture seule, connect() ne requiert pas d'ecriture filesystem) —
 *   appel de org.freedesktop.login1.Manager.Reboot, sans privilèges root.
 * - Hors conteneur sur Linux : systemctl reboot directement.
 */
async function rebootHost(): Promise<void> {
  const socket = process.env.DBUS_SYSTEM_SOCKET ?? '/run/dbus/system_bus_socket';
  if (existsSync(socket)) {
    await run(
      `dbus-send --address=unix:path=${socket} --type=method_call --dest=org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager.Reboot boolean:true`
    );
    return;
  }
  if (process.platform === 'linux') {
    await run('systemctl reboot');
    return;
  }
  throw new Error(
    'Redémarrage indisponible ici : requiert un hôte Linux avec systemd (socket D-Bus).'
  );
}

export function createSiHostClient(): HostClient {
  return {
    reboot: rebootHost,

    async staticInfo(): Promise<HostStatic> {
      const [os, cpu] = await Promise.all([si.osInfo(), si.cpu()]);
      return {
        hostname: os.hostname,
        distro: `${os.distro} ${os.release}`.trim(),
        kernel: os.kernel,
        arch: os.arch,
        cpuModel: `${cpu.manufacturer} ${cpu.brand}`.trim(),
        cores: cpu.cores
      };
    },

    async metrics(): Promise<HostMetrics> {
      const [load, mem, network, disks, temp, procs] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        networkUsage(),
        diskUsage(),
        si.cpuTemperature().catch(() => ({ main: -1 })),
        si.processes().catch(() => ({ all: 0, running: 0 }))
      ]);
      const loadAvg = os.loadavg();
      const total = mem.total;
      // RAM reellement utilisee : total - MemAvailable (exclut le cache et
      // les buffers, que le systeme peut liberer a tout moment). mem.used
      // (total - free) incluait le cache et sur-estimait l'occupation.
      const used = Math.max(0, total - mem.available);
      return {
        uptime: os.uptime(),
        cpu: {
          percent: load.currentLoad,
          load1: loadAvg[0],
          load5: loadAvg[1],
          load15: loadAvg[2]
        },
        memory: {
          total,
          used,
          free: mem.available,
          percent: total > 0 ? (used / total) * 100 : 0,
          swapTotal: mem.swaptotal,
          swapUsed: mem.swapused
        },
        disks,
        network,
        temperatureC: temp.main && temp.main > 0 ? temp.main : null,
        processes: { all: procs.all, running: procs.running }
      };
    }
  };
}