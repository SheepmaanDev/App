# Sheepmaan

Application mobile (React Native / Expo) permettant de piloter vos services
Docker heberges chez vous, completee par un petit serveur `homelab-bridge`
qui fait le lien entre l'app et le socket Docker de votre machine.

> Note : le bridge est concu pour votre reseau local / VPN — pas
> d'exposition publique. Avec un VPN deja en place, l'app fonctionne a
> l'identique a distance, en pointant l'IP LAN du serveur.

## Structure du projet

```
AppMobile/
├─ mobile/                App Expo SDK 57 (TypeScript, Expo Router)
├─ server/                Homelab Bridge : API REST + WebSocket (Node, TS, Fastify, dockerode)
├─ compose.yaml           Deploiement du bridge (Docker Compose, LAN + VPN)
├─ services.yaml.example  Exemple d'annuaire de services
└─ README.md
```

## Quickstart serveur (mode mock, sans Docker)

```bash
cd server
npm install
npm run dev        # MOCK_DOCKER=true par defaut -> aucune dependance Docker
```

Le bridge demarre sur `http://localhost:9999`.

Tester avec curl :

```bash
curl http://localhost:9999/health
curl -H "Authorization: Bearer dev-token" http://localhost:9999/containers
curl -H "Authorization: Bearer dev-token" http://localhost:9999/services
curl -X POST -H "Authorization: Bearer dev-token" http://localhost:9999/containers/vaultwarden/start
```

> 💡 **Sous Windows / PowerShell** : `curl` est un alias de `Invoke-WebRequest`, qui ne
> comprend pas les options `-H` / `-X`. Deux options valides :

```powershell
# Option A : le vrai curl installe avec Windows
curl.exe -H "Authorization: Bearer dev-token" http://localhost:9999/containers

# Option B : PowerShell natif (headers en hashtable)
Invoke-RestMethod -Uri http://localhost:9999/containers -Headers @{ Authorization = 'Bearer dev-token' }
```

> En mode mock, un token de demo `dev-token` est actif, des conteneurs
> factices (portainer, jellyfin, grafana...) permettent de developper l'app.

## Mode reel (Docker sur votre serveur)

Copier `server/.env.example` vers `server/.env`, puis :

```
BRIDGE_TOKEN=<chaine aleatoire longue>
MOCK_DOCKER=false
```

Le bridge pilote le socket `/var/run/docker.sock`. Sur Windows pur, il faut
Docker Desktop et adapter `DOCKER_SOCKET`.

## App mobile (Expo)

Prerequis : Node 20+, un telephone avec **Expo Go** (ou un navigateur.
Le projet cible **SDK Expo 54**, la version supportee par l'Expo Go du
Play Store / App Store (V54.x).

```bash
# 1. Lancer le bridge (dans un terminal)
cd server && npm run dev            # mode mock par defaut (aucun Docker requis)

# 2. Lancer l'app (dans un autre terminal)
cd mobile && npm install
npm run web                          # navigateur (react-native-web)
# ou : npm start                    # Expo Go sur telephone (scanner le QR code)
```

Dans l'app, page **Reglages** (menu ☰), renseigner :

- **Adresse du bridge** : `http://<IP-de-votre-machine>:9999`
  (sur un telephone, PAS `localhost` — utilisez l'IP LAN. Sur un
  navigateur sur la meme machine, `http://localhost:9999` fonctionne.)
- **Jeton** : `dev-token` (mode mock, ou votre `BRIDGE_TOKEN` (mode reel.



Puis **Tester la connexion** puis **Enregistrer**. La page **Conteneurs**
affiche les cartes et permet Start / Stop / Restart (tire-pour-rafraichir
ou bouton refresh). La page **Services** presente l'annuaire de vos
interfaces web (services.yaml) avec l'etat du conteneur lie ; un appui
ouvre l'UI en WebView integree (navigateur sur le web). La page
**Conteneurs** propose une recherche (nom/image), des filtres
(Tous / En marche / Arretes) et un rafraichissement automatique
configurable dans Reglages (Off / 5 s / 15 s / 30 s). Un bandeau signale
la perte de reseau ; les actions donnent un retour haptique sur mobile.

La navigation se fait via un **menu lateral** (drawer) ouvrable/fermable :
bouton ☰ dans chaque en-tete, swipe depuis le bord gauche. Ordre :
**Accueil, Machine, Conteneurs, Services, Reglages**. La page **Accueil**
resume l'essentiel (machine, conteneurs actifs, services) avec des cartes
cliquables vers chaque section.

> Note cleartext : pour la simplicite du LAN, l'app autorise le HTTP
> (`usesCleartextTraffic` sur Android, `NSAllowsLocalNetworking` sur iOS,
> configures dans `mobile/app.json`).

Structure du code mobile :

```
mobile/src/
├─ app/                Routes Expo Router (layout racine + menu lateral)
│  ├─ (drawer)/
│  │  ├─ _layout.tsx   Drawer : menu ☰ ouvrable/fermable, theme sombre
│  │  ├─ index.tsx     Accueil (tableau de bord : machine, conteneurs, services)
│  │  ├─ machine.tsx   Machine (CPU, RAM, disques, reseau, temp.)
│  │  ├─ conteneurs.tsx Conteneurs (cartes, etat, actions, recherche/filtres)
│  │  ├─ services.tsx  Services (annuaire, etat des conteneurs lies)
│  │  └─ settings.tsx  Reglages (URL + token, test de connexion)
│  ├─ container/[id].tsx  Detail conteneur (logs live WS + stats CPU/RAM)
│  └─ service-view.tsx    UI web d'un service en WebView integree (natif)
├─ api/                Client du bridge (fetch + Bearer, timeout) + stockage securise
├─ components/         ContainerCard, StatusBadge, ScreenHeader, LogViewer, StatsGrid, ServiceCard, OfflineBanner, MetricBar, MenuButton
├─ hooks/              useOnline (NetInfo : detection hors-ligne, mobile + web)
├─ stores/             Zustand (config bridge + auto-refresh persistes : SecureStore natif / localStorage web)
├─ utils/              Confirmations, alertes, formatage (octets, debits, durees)
├─ utils/              Confirmations et alertes (mobile + web)
├─ types.ts            Types partages avec le serveur
└─ theme.ts            Palette sombre « console »
```

Validation rapide du projet mobile :

```bash
cd mobile
npm run typecheck                  # TypeScript strict
npx expo export --platform web      # bundle Metro + rendu statique (smoke test)
```

## Annuaire des services (services.yaml)

La page **Services** de l'app lit un fichier YAML declare par le bridge
(defaut : `services.yaml` a cote du bridge, personnalisable via la variable
`SERVICES_FILE`). Partez de l'exemple fourni :

```bash
cp services.yaml.example server/services.yaml   # dev local
# ou : cp services.yaml.example services.yaml   # a cote de compose.yaml
```

Champs : `name` et `url` obligatoires (http/https), puis `description`,
`category`, `icon` (nom d'icone Ionicons) et `container` (nom du conteneur
Docker lie : l'app affiche son etat en temps reel). Les entrees invalides
sont ignorees ; un YAML invalide degrade en liste vide (le bridge reste UP).

## Deploiement avec Docker Compose

Pour un lancement local du bridge (`npm run dev`), copiez la config d'exemple :

```bash
cp server/.env.example server/.env
```

Pour Docker Compose, creez un fichier `.env` a cote de `compose.yaml`
(le compose y lit `BRIDGE_TOKEN`, et `DOMAIN` pour le mode proxy) :

```
BRIDGE_TOKEN=<longue chaine aleatoire>
# DOMAIN=homelab.votredomaine.fr    # requis pour l'exposition publique
```

Puis :

```bash
docker compose up -d --build
```

Le bridge ecoute sur `0.0.0.0:9999` : joignable depuis le LAN et depuis le
VPN a l'IP du serveur (ex: `http://192.168.1.20:9999`), protege par le
token. **Ne redirigez jamais ce port vers Internet** : l'acces distant
passe par votre VPN.

## API

Toutes les routes exigent `Authorization: Bearer <token>` sauf `/health`.

| Methode | Route                        | Description                          |
|---------|------------------------------|--------------------------------------|
| GET     | /health                      | Etat du bridge (public)              |
| GET     | /system/info                 | Infos Docker (versions, compteurs)   |
| GET     | /containers?all=true         | Liste conteneurs                     |
| GET     | /containers/:id              | Detail d'un conteneur                |
| POST    | /containers/:id/start        | Demarrer un conteneur                |
| POST    | /containers/:id/stop         | Arreter un conteneur                 |
| POST    | /containers/:id/restart      | Redemarrer un conteneur              |
| GET     | /containers/:id/logs?tail=N  | Dernieres lignes de logs (JSON)      |
| GET     | /containers/:id/stats        | Stats instantanees CPU / RAM / reseau|
| WS GET  | /containers/:id/logs/stream  | Logs en temps reel (WebSocket)       |
| GET     | /services                    | Annuaire des services (services.yaml)|
| GET     | /host/metrics                | Metriques machine (CPU, RAM, reseau…)|
| WS GET  | /host/ssh                    | Terminal SSH (proxy ssh2 de l'hote)  |
| POST    | /host/reboot                 | Redemarrer la machine hote (systemd) |

`:id` accepte l'ID Docker (ou un prefixe unique) et le nom du conteneur.

La route WebSocket accepte trois modes d'authentification (ordre de
priorite) : header `Authorization: Bearer`, query `?token=`, puis premier
message `{"type":"auth","token":"..."}` sous 5 s (utile en React Native,
qui ne peut pas envoyer de headers custom). Sans authentification, la
socket est fermee avec le code **4401** ; conteneur inconnu, code **4404**.



## Acces a distance via votre VPN

Le bridge n'est **jamais expose sur Internet**. L'app est concue pour un
usage local ou via votre VPN (deja en place chez vous) :

1. Le bridge ecoute sur `0.0.0.0:9999` (voir `compose.yaml`) : il est
   joignable a l'IP LAN du serveur, ex. `http://192.168.1.20:9999`.
2. Connectez le telephone a votre VPN, puis utilisez **la meme adresse**
   dans la page Reglages : le tunnel route le trafic vers le LAN, le
   bridge repond comme si vous etiez a la maison (conteneurs, logs,
   stats, services).

### Regles de securite

- **Ne redirigez jamais** le port 9999 depuis votre box vers Internet :
  l'acces distant passe exclusivement par le VPN.
- Le **BRIDGE_TOKEN** reste requis sur toutes les routes (hors `/health`) :
  il protege aussi les appareils du reseau local.
- Socket Docker monte en **lecture seule**, conteneur `read_only` +
  `no-new-privileges`.
- Les URL de `services.yaml` en IP LAN fonctionnent telles quelles via le
  VPN (la WebView et le client de l'app acceptent le HTTP local).

## Supervision de la machine (page Machine)

La page **Machine** affiche les metriques de la Debian qui heberge le
bridge, rafraichies toutes les 3 s : CPU + charge (1/5/15 min), RAM et
swap (RAM **hors cache/buffers**, calculee via MemAvailable), disques par
partition (locaux, RAID et **montages NFS/CIFS/SMB** inclus), debits
reseau (descendant / montant) et totaux, temperature CPU (si les capteurs
sont exposes, ex. lm-sensors), uptime et nombre de processus. Un bouton
**Reboot** (double confirmation) redemarre la machine via le socket D-Bus
systeme de l'hote, sans privileges root dans le conteneur.

Dans `compose.yaml`, le bridge tourne avec `network_mode: host`,
`pid: host`, le socket D-Bus monte, et la racine de l'hote montee en
lecture seule sur `/hostfs` avec **propagation rslave** (les sous-montages
de l'hote restent visibles -> statfs correct par montage, y compris NFS).
Hors Docker (developpement), `systeminformation` mesure directement la
machine locale.

## Terminal SSH (Machine -> Terminal SSH)

Depuis la page **Machine**, la ligne **Terminal SSH** ouvre un terminal
de commandes vers la Debian. Le bridge joue le role de **proxy** : via un
WebSocket `/host/ssh` (protege par le token, meme modele que les logs
live), il se connecte avec `ssh2` au serveur SSH de la machine
(`127.0.0.1`, port configurable via `SSH_PORT`, 22 par defaut) et relaie
les commandes.

- Identifiants stockes **uniquement sur le telephone** (SecureStore) et
  transmis au bridge via le VPN au moment du connect.
- Mode **sans PTY** : sortie propre ligne par ligne — privilegie les
  commandes simples (`systemctl status`, `df -h`, `docker ps`, `tail`...) ;
  les interfaces TUI (`htop`, `nano`) ne se rendent pas dans ce terminal.
- Fermeture du flux = fin de la session SSH cote bridge (rien ne reste
  ouvert).

## Tests

```bash
cd server
npm test          # vitest, toutes routes testees via app.inject
npm run build     # compilation TypeScript
```

## Securite

- Socket Docker monte en lecture seule (`:ro`).
- Token Bearer obligatoire sur toutes les routes (hors /health), compare en
  temps constant.
- Le conteneur tourne avec `no-new-privileges`, filesystem en `read_only`.
- Aucune exposition Internet : acces LAN + VPN uniquement (ne redirigez pas
  le port 9999 sur votre box).



## Roadmap

- **[x] Sprint 2** : app mobile Expo (tabs, ecran Conteneurs, reglages bridge/token, test de connexion, HTTP LAN autorise)
- **[x] Sprint 3** : logs temps reel (WebSocket /containers/:id/logs/stream), stats CPU/RAM/reseau, ecran detail conteneur
- **[x] Sprint 4** : annuaire de services (GET /services, services.yaml) + WebView integree des UIs web
- **[x] Sprint 5** : recherche + filtres conteneurs, auto-refresh configurable (Off/5s/15s/30s), detection hors-ligne (NetInfo), retour haptique (expo-haptics), metadonnees web (PWA favicon/theme)
- **[x] Sprint 6** : exposition publique retiree -> acces distant via le VPN existant (compose sur 0.0.0.0:9999, garde-fous documentes)
- **[x] Sprint 7** : supervision de la machine hote (GET /host/metrics, page Machine : CPU/RAM/disques/reseau/temperature ; compose network_mode host + pid host + /hostfs)
- **[x] Sprint 8** : menu lateral (drawer ouvrable/fermable via bouton ☰) + page Accueil tableau de bord ; ordre Accueil / Machine / Conteneurs / Services / Reglages
- **[x] Sprint 9** : RAM hors cache (MemAvailable), disques NFS/CIFS/SMB (propagation rslave), redemarrage de la machine (POST /host/reboot via socket D-Bus, bouton Reboot avec confirmation)
- **[x] Sprint 10** : terminal SSH dans l'app (WS /host/ssh, proxy ssh2 vers 127.0.0.1, identifiants SecureStore, console sans PTY)