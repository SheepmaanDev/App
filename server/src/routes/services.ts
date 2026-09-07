import type { FastifyInstance } from 'fastify';
import { loadServices } from '../services/registry.js';

/**
 * Annuaire des services web du homelab : GET /services
 * (source : services.yaml, ou exemples en mode mock).
 */
export function registerServiceRoutes(
  app: FastifyInstance,
  servicesFile: string,
  mockDocker: boolean
): void {
  app.get('/services', async () => {
    const { services, source } = loadServices(servicesFile, mockDocker);
    return { count: services.length, source, services };
  });
}