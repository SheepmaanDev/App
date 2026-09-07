import { Readable } from 'node:stream';
import Docker, {
  type ContainerInfo,
  type ContainerInspectInfo
} from 'dockerode';
import {
  DockerNotFoundError,
  type ContainerDetail,
  type ContainerState,
  type ContainerStats,
  type ContainerSummary,
  type DockerClient,
  type LogStreamHandle,
  type LogStreamOptions,
  type SystemInfo
} from './types.js';

function is404(error: unknown): boolean {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode?: number }).statusCode === 404;
  }
  return false;
}

/** Demultiplexeur des flux de logs Docker (frames : 8 octets d'entete + payload). */
function createLogDemuxer(onLine: (line: string) => void): {
  push(chunk: Buffer): void;
} {
  let buffer = Buffer.alloc(0);
  return {
    push(chunk: Buffer) {
      buffer = Buffer.concat([buffer, chunk]);
      let offset = 0;
      while (offset + 8 <= buffer.length) {
        const size = buffer.readUInt32BE(offset + 4);
        if (offset + 8 + size > buffer.length) break;
        const payload = buffer.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size;
        const text = payload.toString('utf8');
        if (text) {
          for (const line of text.split('\n')) {
            if (line) onLine(line);
          }
        }
      }
      buffer = buffer.subarray(offset);
    }
  };
}

interface DockerStatsSample {
  read?: string;
  cpu_stats?: {
    cpu_usage?: { total_usage?: number; percpu_usage?: number[] };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats?: {
    cpu_usage?: { total_usage?: number };
    system_cpu_usage?: number;
  };
  memory_stats?: { usage?: number; limit?: number };
  networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{ op?: string; value?: number }>;
  };
  pids_stats?: { current?: number };
}

function computeStats(first: DockerStatsSample, second: DockerStatsSample): ContainerStats {
  const cpuDelta =
    (second.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (first.cpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (second.cpu_stats?.system_cpu_usage ?? 0) -
    (first.cpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus =
    second.cpu_stats?.online_cpus ??
    first.cpu_stats?.online_cpus ??
    second.cpu_stats?.cpu_usage?.percpu_usage?.length ??
    1;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

  const memUsage = second.memory_stats?.usage ?? 0;
  const memLimit = second.memory_stats?.limit ?? 0;
  const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

  let netRxBytes = 0;
  let netTxBytes = 0;
  for (const iface of Object.values(second.networks ?? {})) {
    netRxBytes += iface?.rx_bytes ?? 0;
    netTxBytes += iface?.tx_bytes ?? 0;
  }

  let blockReadBytes = 0;
  let blockWriteBytes = 0;
  for (const item of second.blkio_stats?.io_service_bytes_recursive ?? []) {
    if (item.op === 'read') blockReadBytes += item.value ?? 0;
    else if (item.op === 'write') blockWriteBytes += item.value ?? 0;
  }

  return {
    read: second.read ?? new Date().toISOString(),
    cpuPercent,
    memUsage,
    memLimit,
    memPercent,
    netRxBytes,
    netTxBytes,
    blockReadBytes,
    blockWriteBytes,
    pids: second.pids_stats?.current ?? 0
  };
}

function toSummary(c: ContainerInfo): ContainerSummary {
  return {
    id: c.Id,
    name: c.Names?.[0] ?? c.Id,
    image: c.Image,
    state: (c.State as ContainerState) ?? 'exited',
    status: c.Status ?? '',
    createdAt: new Date((c.Created ?? 0) * 1000).toISOString(),
    ports: (c.Ports ?? []).map((p) => ({
      containerPort: p.PrivatePort,
      hostPort: p.PublicPort,
      protocol: p.Type
    })),
    labels: c.Labels ?? {}
  };
}

function toStringArray(value: string | string[] | undefined): string[] | undefined {
  if (Array.isArray(value)) return value;
  return value === undefined ? undefined : [value];
}

function toDetail(info: ContainerInspectInfo): ContainerDetail {
  const state = info.State?.Status as ContainerState | undefined;
  type PortBindingEntry = { HostIp?: string; HostPort?: string };
  const bindingsByPort = (info.HostConfig?.PortBindings ?? {}) as Record<string, PortBindingEntry[] | undefined>;
  const ports = Object.entries(bindingsByPort).flatMap(([key, bindings]) => {
    const [containerPort, protocol = 'tcp'] = key.split('/');
    return (bindings ?? []).map((b) => ({
      containerPort: Number(containerPort),
      hostPort: b.HostPort ? Number(b.HostPort) : undefined,
      protocol
    }));
  });
  return {
    id: info.Id ?? '',
    name: info.Name ?? info.Id ?? '',
    image: info.Config?.Image ?? info.Image ?? '',
    state: state ?? (info.State?.Running ? 'running' : 'exited'),
    status: info.State?.Status ?? '',
    createdAt: info.Created ?? '',
    ports,
    labels: info.Config?.Labels ?? {},
    restartCount: info.RestartCount,
    startedAt: info.State?.StartedAt,
    config: {
      image: info.Config?.Image,
      cmd: toStringArray(info.Config?.Cmd),
      entrypoint: toStringArray(info.Config?.Entrypoint)
    }
  };
}

/**
 * Client Docker reel base sur dockerode, connecte au socket Unix local.
 */
export function createRealClient(socketPath: string): DockerClient {
  const docker = new Docker({ socketPath });

  const withNotFound =
    (fn: (idOrName: string) => Promise<void>) =>
    async (idOrName: string) => {
      try {
        await fn(idOrName);
      } catch (error) {
        if (is404(error)) throw new DockerNotFoundError(idOrName);
        throw error;
      }
    };

  return {
    async listContainers(all = true) {
      const infos = await docker.listContainers({ all });
      return infos.map(toSummary);
    },

    async getContainer(idOrName) {
      try {
        const info = await docker.getContainer(idOrName).inspect();
        return toDetail(info);
      } catch (error) {
        if (is404(error)) return null;
        throw error;
      }
    },

    startContainer: withNotFound((id) => docker.getContainer(id).start()),
    stopContainer: withNotFound((id) => docker.getContainer(id).stop({ t: 10 })),
    restartContainer: withNotFound((id) =>
      docker.getContainer(id).restart({ t: 10 })
    ),

    async systemInfo(): Promise<SystemInfo> {
      const [version, info] = await Promise.all([docker.version(), docker.info()]);
      return {
        engine: 'docker',
        version: version.Version ?? '',
        apiVersion: version.ApiVersion ?? '',
        name: info.Name ?? '',
        os: info.OperatingSystem ?? '',
        kernel: info.KernelVersion ?? '',
        architecture: info.Architecture ?? '',
        driver: info.Driver ?? '',
        containers: {
          total: info.Containers ?? 0,
          running: info.ContainersRunning ?? 0,
          paused: info.ContainersPaused ?? 0,
          stopped: info.ContainersStopped ?? 0
        }
      };
    },

    async getContainerLogs(idOrName, tail = 200) {
      const count = Math.max(1, Math.min(1000, Math.floor(tail)));
      try {
        // Sans follow:true, dockerode resout un Buffer unique (historique).
        const buffer = await docker.getContainer(idOrName).logs({
          stdout: true,
          stderr: true,
          tail: count,
          timestamps: true,
          follow: false
        });
        const lines: string[] = [];
        const demuxer = createLogDemuxer((line) => lines.push(line));
        demuxer.push(buffer);
        return lines;
      } catch (error) {
        if (is404(error)) throw new DockerNotFoundError(idOrName);
        throw error;
      }
    },

    streamContainerLogs(idOrName, options: LogStreamOptions): LogStreamHandle {
      const demuxer = createLogDemuxer(options.onLine);
      const tail = Math.max(1, options.tail ?? 200);
      let stream: Readable | null = null;
      let closed = false;

      const attach = (s: Readable): void => {
        stream = s;
        if (closed) {
          s.destroy();
          return;
        }
        s.on('data', (chunk: Buffer) => {
          if (!closed) demuxer.push(chunk);
        });
        s.on('error', () => {
          /* le flux est ferme cote docker */
        });
      };
      const fail = (err: unknown): void => {
        options.onError?.(
          is404(err) ? new DockerNotFoundError(idOrName) : (err as Error)
        );
      };
      const container = docker.getContainer(idOrName);

      if (options.follow) {
        // Surcharge Promise { follow: true } -> NodeJS.ReadableStream
        container
          .logs({
            stdout: true,
            stderr: true,
            tail,
            timestamps: true,
            follow: true
          })
          .then((s) => attach(s as Readable))
          .catch(fail);
      } else {
        // Surcharge Promise { follow?: false } -> Buffer (historique seul)
        container
          .logs({
            stdout: true,
            stderr: true,
            tail,
            timestamps: true,
            follow: false
          })
          .then((buffer) => {
            if (!closed) demuxer.push(buffer);
          })
          .catch(fail);
      }

      return {
        close() {
          closed = true;
          if (stream) stream.destroy();
        }
      };
    },

    async getContainerStats(idOrName) {
      try {
        const stream = (await docker
          .getContainer(idOrName)
          .stats({ stream: true })) as Readable;
        return await new Promise<ContainerStats>((resolve, reject) => {
          let first: DockerStatsSample | null = null;
          const timer = setTimeout(() => {
            stream.destroy();
            reject(new Error('Docker stats: delai depasse'));
          }, 6000);

          const onData = (chunk: Buffer) => {
            let sample: DockerStatsSample;
            try {
              sample = JSON.parse(chunk.toString('utf8')) as DockerStatsSample;
            } catch {
              return;
            }
            if (!first) {
              first = sample;
              return;
            }
            clearTimeout(timer);
            stream.removeListener('data', onData);
            stream.destroy();
            resolve(computeStats(first, sample));
          };

          stream.on('data', onData);
          stream.on('error', (e) => {
            clearTimeout(timer);
            reject(e);
          });
        });
      } catch (error) {
        if (is404(error)) throw new DockerNotFoundError(idOrName);
        throw error;
      }
    }
  };
}