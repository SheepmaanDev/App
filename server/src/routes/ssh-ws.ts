import type { FastifyInstance } from 'fastify';
import { isAuthorized } from '../auth.js';
import type { SshSessionFactory, SshSession } from '../ssh/session.js';

const AUTH_GRACE_MS = 5000;
const MAX_COMMAND_LENGTH = 4000;
const MAX_PASSWORD_LENGTH = 512;

interface SshQuery {
  token?: string;
}

type WsMessage = Record<string, unknown>;

/**
 * Terminal SSH : WS /host/ssh
 * Meme modele d'auth que les logs live (header Bearer, query ?token=, ou
 * premier message { type: 'auth', token } sous 5 s -> close 4401).
 * Protocole apres auth :
 *   client { type: 'connect', user, password, port }  -> { type: 'connected' }
 *   client { type: 'run', command }                   -> { type: 'data', text } + { type: 'done', code }
 *   { type: 'error', message } en cas de probleme ; close 4500 sur echec de connexion SSH.
 */
export function registerSshRoutes(
  app: FastifyInstance,
  options: { token: string; factory: SshSessionFactory }
): void {
  app.get<{ Querystring: SshQuery }>(
    '/host/ssh',
    { websocket: true },
    (socket, request) => {
      const send = (msg: WsMessage): void => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(msg));
        }
      };

      let authorized =
        isAuthorized(request.headers.authorization, options.token) ||
        isAuthorized(`Bearer ${request.query?.token ?? ''}`, options.token);
      let session: SshSession | null = null;

      const timer = authorized
        ? null
        : setTimeout(() => {
            if (!authorized) socket.close(4401, 'unauthorized');
          }, AUTH_GRACE_MS);

      const endSession = (): void => {
        session?.end();
        session = null;
      };

      socket.on('message', (raw: Buffer) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(raw.toString()) as WsMessage;
        } catch {
          return; // message illisible : ignore
        }

        if (msg.type === 'auth') {
          if (authorized) return;
          if (isAuthorized(`Bearer ${String(msg.token ?? '')}`, options.token)) {
            authorized = true;
            if (timer) clearTimeout(timer);
            send({ type: 'ready' });
          } else {
            socket.close(4401, 'unauthorized');
          }
          return;
        }

        if (!authorized) {
          socket.close(4401, 'unauthorized');
          return;
        }

        if (msg.type === 'connect') {
          const user = String(msg.user ?? '').trim().slice(0, 64);
          const password = String(msg.password ?? '').slice(0, MAX_PASSWORD_LENGTH);
          const port = Number(msg.port ?? 22);
          if (!user || !password || !(port > 0 && port < 65536)) {
            send({
              type: 'error',
              message: 'Utilisateur, mot de passe ou port manquants/invalides.'
            });
            return;
          }
          endSession();
          options.factory
            .connect(user, password, port)
            .then((s) => {
              session = s;
              send({ type: 'connected' });
            })
            .catch((err: Error) => {
              send({ type: 'error', message: err.message });
              socket.close(4500, 'ssh_error');
            });
          return;
        }

        if (msg.type === 'run') {
          const command = String(msg.command ?? '').slice(0, MAX_COMMAND_LENGTH);
          if (!command.trim()) {
            send({ type: 'error', message: 'Commande vide.' });
            return;
          }
          if (!session) {
            send({
              type: 'error',
              message: 'Non connecté : envoie { type: "connect" } d\u2019abord.'
            });
            return;
          }
          session
            .exec(command)
            .then((res) => {
              send({ type: 'data', text: res.output });
              send({ type: 'done', code: res.code });
            })
            .catch((err: Error) => {
              send({ type: 'error', message: err.message });
            });
          return;
        }
      });

      socket.on('close', () => {
        if (timer) clearTimeout(timer);
        endSession();
      });
    }
  );
}