import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();

try {
  const app = await buildApp({ config, logger: true });
  await app.listen({ port: config.port, host: config.host });
  const { address, port } = app.server.address() as { address: string; port: number };
  app.log.info(`Homelab Bridge pret sur http://${address}:${port}`);
  app.log.info(
    `Mode Docker : ${config.mockDocker ? 'MOCK (aucun Docker requis)' : 'REEL'}`
  );
} catch (error) {
  console.error('Impossible de demarrer le bridge :', error);
  process.exit(1);
}