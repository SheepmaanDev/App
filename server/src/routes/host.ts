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

  /**
   * Redemarrage de la machine hote (POST /host/reboot).
   * Protege par le token ; l'app demande une double confirmation.
   */
  app.post('/host/reboot', async (request, reply) => {
    try {
      await host.reboot();
      return { ok: true, action: 'reboot' };
    } catch (error) {
      return await reply.code(500).send({
        error:
          error instanceof Error ? error.message : 'Redémarrage impossible.'
      });
    }
  });
}