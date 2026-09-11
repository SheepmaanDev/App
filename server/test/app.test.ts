import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { ContainerSummary } from '../src/docker/types.js';
import { parseHostMounts } from '../src/host/si.js';
import type { HostClient } from '../src/host/types.js';
import {
  SshConnectError,
  type SshSession,
  type SshSessionFactory
} from '../src/ssh/session.js';

describe('Homelab Bridge (mode mock)', () => {
  const token = 'test-token';
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ config: { token, mockDocker: true }, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeaders = { authorization: `Bearer ${token}` };

  it('expose /health sans authentification', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
    expect(res.json().service).toBe('homelab-bridge');
  });

  it('refuse /containers sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/containers' });
    expect(res.statusCode).toBe(401);
  });

  it('refuse un mauvais token', async () => {
    const res = await app.inject({ method: 'GET', url: '/containers', headers: { authorization: 'Bearer mauvais' } });
    expect(res.statusCode).toBe(401);
  });

  it('liste les conteneurs avec le bon token', async () => {
    const res = await app.inject({ method: 'GET', url: '/containers', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBeGreaterThan(0);
    const container = body.containers[0] as ContainerSummary;
    expect(container.id).toBeTruthy();
    expect(container.state).toBeTruthy();
  });

  it('renvoie 404 pour un conteneur inconnu', async () => {
    const res = await app.inject({ method: 'GET', url: '/containers/does-not-exist', headers: authHeaders });
    expect(res.statusCode).toBe(404);
  });

  it('demarre un conteneur arrete', async () => {
    const list = await app.inject({ method: 'GET', url: '/containers', headers: authHeaders });
    const containers = list.json().containers as ContainerSummary[];
    const stopped = containers.find((c) => c.state !== 'running');
    expect(stopped).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/containers/${stopped!.id}/start`,
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('running');
  });

  it('stoppe un conteneur qui tourne', async () => {
    const list = await app.inject({ method: 'GET', url: '/containers', headers: authHeaders });
    const containers = list.json().containers as ContainerSummary[];
    const running = containers.find((c) => c.state === 'running');
    expect(running).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/containers/${running!.id}/stop`,
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('exited');
  });

  it('redemarre un conteneur', async () => {
    const list = await app.inject({ method: 'GET', url: '/containers', headers: authHeaders });
    const containers = list.json().containers as ContainerSummary[];
    const running = containers.find((c) => c.state === 'running');

    const res = await app.inject({
      method: 'POST',
      url: `/containers/${running!.id}/restart`,
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe('running');
  });

  it('renvoie 404 quand on demarre un conteneur inexistant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/containers/nope/start',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(404);
  });

  it('fournit les informations systeme', async () => {
    const res = await app.inject({ method: 'GET', url: '/system/info', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    const { info } = res.json();
    expect(info.engine).toBe('mock');
    expect(info.containers.total).toBeGreaterThan(0);
  });

  it('ne demarre pas en mode reel sans token', async () => {
    await expect(
      buildApp({ config: { token: '', mockDocker: false } })
    ).rejects.toThrow('BRIDGE_TOKEN');
  });

  it('active le mode mock par defaut sans variables d environnement', () => {
    const config = loadConfig({});
    expect(config.mockDocker).toBe(true);
    expect(config.token).toBe('dev-token');
  });

  it('renvoie les logs d un conteneur avec une taille bornee', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/containers/1a2b3c4d5e6f/logs?tail=5',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    const { logs } = res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.length).toBeLessThanOrEqual(5);
    expect(logs[0]).toMatch(/\[(INFO|WARN|ERROR)\]/);
  });

  it('renvoie 404 pour les logs d un conteneur inconnu', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/containers/inconnu/logs',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(404);
  });

  it('renvoie les stats d un conteneur', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/containers/jellyfin/stats',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    const { stats } = res.json();
    expect(typeof stats.cpuPercent).toBe('number');
    expect(stats.memLimit).toBeGreaterThan(0);
    expect(typeof stats.netRxBytes).toBe('number');
    expect(typeof stats.pids).toBe('number');
  });

  it('renvoie 404 pour les stats d un conteneur inconnu', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/containers/inconnu/stats',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('Homelab Bridge - WebSocket logs', () => {
  const token = 'test-token';
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ config: { token, mockDocker: true }, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('stream les logs en temps reel avec le token dans la query', async () => {
    const ws = await app.injectWS('/containers/1a2b3c4d5e6f/logs/stream?token=test-token');

    const line = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout: aucun message')), 4000);
      ws.on('message', (data) => {
        clearTimeout(timer);
        resolve(data.toString());
      });
    });

    expect(line.length).toBeGreaterThan(0);
    expect(line).toMatch(/\[(INFO|WARN|ERROR)\]/);
    ws.close();
  });

  it('authentifie via un message { type: auth } apres connexion', async () => {
    const ws = await app.injectWS('/containers/1a2b3c4d5e6f/logs/stream');

    const line = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout auth')), 4000);
      ws.on('message', (data) => {
        clearTimeout(timer);
        resolve(data.toString());
      });
      ws.send(JSON.stringify({ type: 'auth', token }));
    });

    expect(line.length).toBeGreaterThan(0);
    ws.close();
  });

  it('n envoie aucun log sans authentification', async () => {
    const ws = await app.injectWS('/containers/1a2b3c4d5e6f/logs/stream');

    let messageCount = 0;
    const messageWait = new Promise<void>((resolve) => {
      ws.on('message', () => {
        messageCount++;
        resolve();
      });
    });

    const nothing = await Promise.race([
      messageWait.then(() => 'message'),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 500))
    ]);

    expect(nothing).toBe('timeout');
    expect(messageCount).toBe(0);
    ws.close();
  });
});

describe('Annuaire des services (GET /services)', () => {
  const token = 'test-token';
  const authHeaders = { authorization: `Bearer ${token}` };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bridge-services-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuse /services sans token', async () => {
    const app = await buildApp({ config: { token, mockDocker: true } });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/services' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("renvoie des services d'exemple en mock sans fichier", async () => {
    const app = await buildApp({
      config: { token, mockDocker: true, servicesFile: join(dir, 'absent.yaml') }
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/services', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('mock');
    expect(body.count).toBeGreaterThan(0);
    expect(body.services[0].name).toBeTruthy();
    expect(body.services[0].url).toMatch(/^https?:\/\//);
    await app.close();
  });

  it('lit services.yaml et ignore les entrees invalides', async () => {
    const file = join(dir, 'services.yaml');
    writeFileSync(
      file,
      [
        'services:',
        '  - name: Portainer',
        '    url: http://192.168.1.20:9000',
        '    description: Gestion Docker',
        '    category: Outils',
        '    icon: cube-outline',
        '    container: portainer',
        '  - name: Sans URL',
        '  - name: URL invalide',
        '    url: ftp://interdit',
        ''
      ].join('\n')
    );
    const app = await buildApp({
      config: { token, mockDocker: false, servicesFile: file }
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/services', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('file');
    expect(body.count).toBe(1);
    expect(body.services[0].name).toBe('Portainer');
    expect(body.services[0].container).toBe('portainer');
    await app.close();
  });

  it('degrade en liste vide sur un YAML invalide', async () => {
    const file = join(dir, 'broken.yaml');
    writeFileSync(file, 'services: [ { name: sans } ::: <<<');
    const app = await buildApp({
      config: { token, mockDocker: false, servicesFile: file }
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/services', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 0, source: 'empty', services: [] });
    await app.close();
  });

  it('renvoie une liste vide en mode reel sans fichier', async () => {
    const app = await buildApp({
      config: { token, mockDocker: false, servicesFile: join(dir, 'absent.yaml') }
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/services', headers: authHeaders });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 0, source: 'empty', services: [] });
    await app.close();
  });
});

describe('Metriques machine (GET /host/metrics)', () => {
  const token = 'test-token';
  const authHeaders = { authorization: `Bearer ${token}` };

  const fakeHost: HostClient = {
    staticInfo: async () => ({
      hostname: 'debian',
      distro: 'Debian GNU/Linux 13',
      kernel: '6.12.0',
      arch: 'x64',
      cpuModel: 'Test CPU 4 coeurs',
      cores: 4
    }),
    metrics: async () => ({
      uptime: 7200,
      cpu: { percent: 12.5, load1: 0.1, load5: 0.2, load15: 0.3 },
      memory: {
        total: 8e9,
        used: 4e9,
        free: 4e9,
        percent: 50,
        swapTotal: 1e9,
        swapUsed: 0
      },
      disks: [{ mount: '/', total: 500e9, used: 250e9, percent: 50 }],
      network: [{ name: 'eth0', rxRate: 1000, txRate: 500, rxTotal: 10, txTotal: 20 }],
      temperatureC: 55,
      processes: { all: 120, running: 2 }
    }),
    reboot: async () => undefined
  };

  it('refuse /host/metrics sans token', async () => {
    const app = await buildApp({
      config: { token, mockDocker: true },
      hostClient: fakeHost
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/host/metrics' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('renvoie infos + metriques avec le token', async () => {
    const app = await buildApp({
      config: { token, mockDocker: true },
      hostClient: fakeHost
    });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/host/metrics',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.host.hostname).toBe('debian');
    expect(body.host.distro).toContain('Debian');
    expect(body.metrics.cpu.percent).toBe(12.5);
    expect(body.metrics.memory.percent).toBe(50);
    expect(body.metrics.disks).toHaveLength(1);
    expect(body.metrics.network[0].name).toBe('eth0');
    expect(body.metrics.temperatureC).toBe(55);
    expect(body.metrics.processes.all).toBe(120);
    await app.close();
  });

  it('renvoie temperatureC a null si non disponible', async () => {
    const app = await buildApp({
      config: { token, mockDocker: true },
      hostClient: {
        ...fakeHost,
        metrics: async () => ({
          ...(await fakeHost.metrics()),
          temperatureC: null
        })
      }
    });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/host/metrics',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().metrics.temperatureC).toBeNull();
    await app.close();
  });

  it('POST /host/reboot : 401 sans token, ok avec le token', async () => {
    const app = await buildApp({
      config: { token, mockDocker: true },
      hostClient: fakeHost
    });
    await app.ready();

    const noAuth = await app.inject({ method: 'POST', url: '/host/reboot' });
    expect(noAuth.statusCode).toBe(401);

    const res = await app.inject({
      method: 'POST',
      url: '/host/reboot',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, action: 'reboot' });
    await app.close();
  });

  it('POST /host/reboot renvoie 500 avec le message en cas d echec', async () => {
    const app = await buildApp({
      config: { token, mockDocker: true },
      hostClient: {
        ...fakeHost,
        reboot: async () => {
          throw new Error('Redémarrage indisponible ici');
        }
      }
    });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/host/reboot',
      headers: authHeaders
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toContain('Redémarrage indisponible');
    await app.close();
  });
});

describe("parseHostMounts (disques de l'hote)", () => {
  it('garde les vraies partitions et deduplique par peripherique', () => {
    const content = [
      '20 1 8:1 / / rw,relatime - ext4 /dev/sda1 rw',
      '21 1 8:2 /boot /boot rw,relatime - ext4 /dev/sda2 rw',
      '35 1 8:1 /home /home rw,relatime - ext4 /dev/sda1 rw',
      '40 1 0:40 / /proc rw,relatime - proc proc rw',
      '50 1 0:50 / /run rw,nosuid - tmpfs tmpfs rw',
      '60 1 253:0 /data /mnt/data\\040disque rw - xfs /dev/mapper/vg-data rw',
      '70 1 0:60 / /mnt/nas rw,relatime - nfs4 192.168.1.50:/volume1/nas rw'
    ].join('\n');
    const mounts = parseHostMounts(content);
    expect(mounts).toEqual([
      { mount: '/', source: '/dev/sda1' },
      { mount: '/boot', source: '/dev/sda2' },
      { mount: '/mnt/data disque', source: '/dev/mapper/vg-data' },
      { mount: '/mnt/nas', source: '192.168.1.50:/volume1/nas' }
    ]);
  });
});

describe('Terminal SSH (WS /host/ssh)', () => {
  const token = 'test-token';

  const fakeSession: SshSession = {
    exec: async (command) => ({ output: `OK:${command}`, code: 0 }),
    end: () => undefined
  };
  const fakeFactory: SshSessionFactory = {
    connect: async (user) => {
      if (user === 'mauvais') {
        throw new SshConnectError('Identifiants SSH refusés par la machine.');
      }
      return fakeSession;
    }
  };

  function build() {
    return buildApp({
      config: { token, mockDocker: true },
      sshFactory: fakeFactory
    });
  }

  // Note : injectWS renvoie un socket deja ouvert (readyState 1) — on envoie
  // immediatement, sans attendre un event 'open' qui a deja eu lieu.
  it('ferme 4401 sur un auth SSH invalide', async () => {
    const app = await build();
    await app.ready();
    const ws = await app.injectWS('/host/ssh');
    const closed = new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
    });
    ws.send(JSON.stringify({ type: 'auth', token: 'mauvais-token' }));
    const code = await closed;
    expect(code).toBe(4401);
    await app.close();
  });

  it('connecte puis execute une commande (fake)', async () => {
    const app = await build();
    await app.ready();
    const ws = await app.injectWS('/host/ssh');
    const messages: Array<Record<string, unknown>> = [];
    const connected = new Promise<void>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const m = JSON.parse(raw.toString()) as Record<string, unknown>;
        messages.push(m);
        if (m.type === 'connected') resolve();
      });
    });
    ws.send(JSON.stringify({ type: 'auth', token }));
    ws.send(
      JSON.stringify({ type: 'connect', user: 'qmouton', password: 'secret', port: 22 })
    );
    await connected;

    const donePromise = new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const m = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (m.type === 'done') resolve(m);
      });
    });
    ws.send(JSON.stringify({ type: 'run', command: 'systemctl status' }));
    const done = await donePromise;

    expect(done.code).toBe(0);
    const data = messages.find((m) => m.type === 'data') as { text: string };
    expect(data.text).toBe('OK:systemctl status');
    ws.close();
    await app.close();
  });

  it('renvoie une erreur si les identifiants SSH sont refuses', async () => {
    const app = await build();
    await app.ready();
    const ws = await app.injectWS('/host/ssh');
    const failed = new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const m = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (m.type === 'error') resolve(m);
      });
    });
    ws.send(JSON.stringify({ type: 'auth', token }));
    ws.send(
      JSON.stringify({ type: 'connect', user: 'mauvais', password: 'x', port: 22 })
    );
    const m = await failed;
    expect(String(m.message)).toContain('Identifiants SSH refusés');
    ws.close();
    await app.close();
  });
});