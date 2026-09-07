import type { FastifyInstance } from 'fastify';

export const SERVICE_NAME = 'homelab-bridge';
export const SERVICE_VERSION = '0.1.0';

/**
 * Route publique (pas d'authentification) : utilisee par le healthcheck
 * du conteneur et pour verifier que le bridge est joignable.
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }));
}