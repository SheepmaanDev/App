import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

/** Un service web heberge dans le homelab (annuaire services.yaml). */
export interface ServiceEntry {
  name: string;
  url: string;
  description?: string;
  category?: string;
  /** Nom d'icone Ionicons affiche par l'app. */
  icon?: string;
  /** Nom du conteneur Docker lie (affiche l'etat live dans l'app). */
  container?: string;
}

export type ServicesSource = 'file' | 'mock' | 'empty';

const MOCK_SERVICES: ServiceEntry[] = [
  {
    name: 'Portainer',
    url: 'http://localhost:9000',
    description: 'Gestion Docker en interface web',
    category: 'Outils',
    icon: 'cube-outline',
    container: 'portainer'
  },
  {
    name: 'Jellyfin',
    url: 'http://localhost:8096',
    description: 'Mediatheque films et series',
    category: 'Media',
    icon: 'film-outline',
    container: 'jellyfin'
  },
  {
    name: 'Grafana',
    url: 'http://localhost:3000',
    description: 'Tableaux de bord et supervision',
    category: 'Supervision',
    icon: 'stats-chart-outline',
    container: 'grafana'
  },
  {
    name: 'Home Assistant',
    url: 'http://localhost:8123',
    description: 'Domotique',
    category: 'Maison',
    icon: 'home-outline',
    container: 'home-assistant'
  },
  {
    name: 'n8n',
    url: 'http://localhost:5678',
    description: 'Automatisations et workflows',
    category: 'Outils',
    icon: 'git-branch-outline',
    container: 'n8n'
  }
];

/**
 * Valide et normalise une entree du YAML. Renvoie null si l'entree est
 * inutilisable (sans nom, ou URL non http/https) : elle est ignoree.
 */
function normalizeEntry(raw: unknown): ServiceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  if (!name || !/^https?:\/\//i.test(url)) return null;

  const entry: ServiceEntry = { name, url };
  const str = (v: unknown): string =>
    typeof v === 'string' && v.trim() ? v.trim() : '';
  const description = str(r.description);
  const category = str(r.category);
  const icon = str(r.icon);
  const container = str(r.container).replace(/^\//, '');
  if (description) entry.description = description;
  if (category) entry.category = category;
  if (icon) entry.icon = icon;
  if (container) entry.container = container;
  return entry;
}

/**
 * Charge l'annuaire des services depuis le fichier YAML.
 * - fichier absent : services d'exemple en mock, liste vide en mode reel
 * - fichier illisible ou YAML invalide : liste vide (le bridge reste UP)
 * - entrees invalides : ignorees individuellement
 */
export function loadServices(
  filePath: string,
  mockDocker: boolean
): { services: ServiceEntry[]; source: ServicesSource } {
  if (!existsSync(filePath)) {
    return mockDocker
      ? { services: MOCK_SERVICES, source: 'mock' }
      : { services: [], source: 'empty' };
  }
  try {
    const raw = parse(readFileSync(filePath, 'utf8')) as unknown;
    const list: unknown[] = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { services?: unknown[] }).services)
        ? (raw as { services: unknown[] }).services
        : [];
    const services = list
      .map(normalizeEntry)
      .filter((s): s is ServiceEntry => s !== null);
    return { services, source: 'file' };
  } catch {
    // YAML invalide ou fichier illisible : on degrade proprement.
    return { services: [], source: 'empty' };
  }
}