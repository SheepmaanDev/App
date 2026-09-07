import 'dotenv/config';
import path from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  token: string;
  mockDocker: boolean;
  dockerSocket: string;
  servicesFile: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Mode mock active PAR DEFAUT (confort de dev : aucun Docker requis).
  // En production, compose.yaml passe explicitement MOCK_DOCKER="false".
  const mockDocker =
    env.MOCK_DOCKER === undefined ? true : env.MOCK_DOCKER === 'true';
  return {
    port: Number(env.PORT ?? 9999),
    host: env.HOST ?? '0.0.0.0',
    // En mode mock on fournit un token de ref pour demarrer sans config.
    // En mode reel, BRIDGE_TOKEN est obligatoire (verifie dans buildApp).
    token: env.BRIDGE_TOKEN ?? (mockDocker ? 'dev-token' : ''),
    mockDocker,
    dockerSocket: env.DOCKER_SOCKET ?? '/var/run/docker.sock',
    // Annuaire des services (YAML). Par defaut : services.yaml dans le
    // repertoire de travail du bridge (server/ en dev, /app dans Docker).
    servicesFile: path.resolve(env.SERVICES_FILE ?? 'services.yaml')
  };
}