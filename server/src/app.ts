import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { isAuthorized } from './auth.js';
import { loadConfig, type AppConfig } from './config.js';
import { createMockClient } from './docker/mock.js';
import { createRealClient } from './docker/dockerode.js';
import type { DockerClient } from './docker/types.js';
import { createSiHostClient } from './host/si.js';
import type { HostClient } from './host/types.js';
import { registerContainerRoutes } from './routes/containers.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerHostRoutes } from './routes/host.js';
import { registerLogsWsRoutes } from './routes/logs-ws.js';
import { registerServiceRoutes } from './routes/services.js';
import { registerSshRoutes } from './routes/ssh-ws.js';
import { registerSystemRoutes } from './routes/system.js';
import { createSshSessionFactory } from './ssh/session.js';
import type { SshSessionFactory } from './ssh/session.js';

export interface BuildAppOptions {
  config?: Partial<AppConfig>;
  docker?: DockerClient;
  /** Injecte un fournisseur de metriques hote (tests). Defaut : systeminformation. */
  hostClient?: HostClient;
  /** Injecte une fabrique de sessions SSH (tests). Defaut : ssh2 vers 127.0.0.1. */
  sshFactory?: SshSessionFactory;
  logger?: boolean;
}

/** Seules ces routes sont accessibles sans token. */
const PUBLIC_ROUTES = new Set(['/health']);

/**
 * Construit l'application Fastify (injectable pour les tests).
 * - authentification Bearer obligatoire sauf sur les routes publiques
 * - client Docker reel (socket) ou mock selon la configuration
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config: AppConfig = { ...loadConfig(), ...options.config };

  if (!config.token && !config.mockDocker) {
    throw new Error(
      'BRIDGE_TOKEN est obligatoire quand MOCK_DOCKER=false (voir server/.env.example)'
    );
  }

  const docker: DockerClient =
    options.docker ??
    (config.mockDocker
      ? createMockClient()
      : createRealClient(config.dockerSocket));

  const hostClient = options.hostClient ?? createSiHostClient();

  const app = Fastify({ logger: options.logger ?? false });

  // WebSocket : le plugin NE doit PAS bloquer les upgrades websocket dans le
  // hook preHandler (l'auth WS est geree dans logs-ws.ts : header, query ou message).
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  app.addHook('preHandler', async (request, reply) => {
    if (request.routeOptions.url && PUBLIC_ROUTES.has(request.routeOptions.url)) {
      return;
    }
    // Upgrade WebSocket : l'authentification est geree dans le handler WS.
    if ((request.headers.upgrade ?? '').toLowerCase() === 'websocket') {
      return;
    }
    if (!isAuthorized(request.headers.authorization, config.token)) {
      await reply.code(401).send({ error: 'unauthorized' });
    }
  });

  registerHealthRoutes(app);
  registerSystemRoutes(app, docker);
  registerContainerRoutes(app, docker);
  registerLogsWsRoutes(app, docker, config.token);
  registerServiceRoutes(app, config.servicesFile, config.mockDocker);
  registerHostRoutes(app, hostClient);
  registerSshRoutes(app, {
    token: config.token,
    factory: options.sshFactory ?? createSshSessionFactory()
  });

  return app;
}