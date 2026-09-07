import type { FastifyInstance } from 'fastify';
import type { DockerClient } from '../docker/types.js';

export function registerSystemRoutes(app: FastifyInstance, docker: DockerClient): void {
  app.get('/system/info', async () => {
    const info = await docker.systemInfo();
    return { info };
  });
}