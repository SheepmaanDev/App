import type { FastifyInstance } from 'fastify';
import type { HostClient } from '../host/types.js';

/**
 * Metriques de la machine hote : GET /host/metrics
 * (CPU, RAM, disques, reseau, temperature, uptime — voir host/types.ts).
 * Protegee par le token global comme les autres routes.
 */
export function registerHostRoutes(
  app: FastifyInstance,
  host: HostClient
): void {
  app.get('/host/metrics', async () => {
    const [hostInfo, metrics] = await Promise.all([
      host.staticInfo(),
      host.metrics()
    ]);
    return { host: hostInfo, metrics };
  });
}