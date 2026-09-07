import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { isAuthorized } from '../auth.js';
import {
  DockerNotFoundError,
  type DockerClient,
  type LogStreamHandle
} from '../docker/types.js';

interface LogsWsQuery {
  token?: string;
}

function decodeId(raw: string): string {
  return decodeURIComponent(raw).replace(/^\//, '');
}

const AUTH_GRACE_MS = 5000;

/**
 * Route WebSocket : GET /containers/:id/logs/stream
 * (chemin distinct de la route REST /containers/:id/logs, tous deux en GET)
 * Diffuse les logs d'un conteneur en temps reel.
 *
 * Authentification acceptee par (ordre de priorite) :
 *  1. header Authorization: Bearer <token>  (client capable d'envoyer des headers)
 *  2. query ?token=<token>
 *  3. premier message { type: 'auth', token: <token> } (React Native WebSocket,
 *     qui ne permet pas de headers custom) — a envoyer dans les 5 s.
 */
export function registerLogsWsRoutes(
  app: FastifyInstance,
  docker: DockerClient,
  expectedToken: string
): void {
  app.get<{ Params: { id: string }; Querystring: LogsWsQuery }>(
    '/containers/:id/logs/stream',
    { websocket: true },
    (socket: WebSocket, request) => {
      const id = decodeId(request.params.id);
      const authorized =
        isAuthorized(request.headers.authorization, expectedToken) ||
        isAuthorized(`Bearer ${request.query?.token ?? ''}`, expectedToken);

      let stream: LogStreamHandle | null = null;

      const startStream = () => {
        if (stream) return;
        try {
          stream = docker.streamContainerLogs(id, {
            tail: 200,
            follow: true,
            onLine: (line) => {
              if (socket.readyState === socket.OPEN) socket.send(line);
            },
            onError: (error) => {
              if (error instanceof DockerNotFoundError) {
                if (socket.readyState === socket.OPEN) {
                  socket.close(4404, 'not_found');
                }
              }
            }
          });
        } catch (error) {
          if (error instanceof DockerNotFoundError) {
            if (socket.readyState === socket.OPEN) socket.close(4404, 'not_found');
          } else if (socket.readyState === socket.OPEN) {
            socket.close(1011, 'internal_error');
          }
        }
      };

      if (authorized) {
        startStream();
      } else {
        // Handshake : on attend un message { type: 'auth', token }.
        const timer = setTimeout(() => {
          if (!stream && socket.readyState === socket.OPEN) {
            socket.close(4401, 'unauthorized');
          }
        }, AUTH_GRACE_MS);
        socket.on('message', (data) => {
          try {
            const parsed = JSON.parse(data.toString()) as {
              type?: string;
              token?: string;
            };
            if (parsed?.type === 'auth' && !authorized) {
              if (isAuthorized(`Bearer ${parsed.token ?? ''}`, expectedToken)) {
                startStream();
              } else {
                socket.close(4401, 'unauthorized');
              }
            }
          } catch {
            // message illisible : ignore
          }
        });
        socket.on('close', () => clearTimeout(timer));
      }

      socket.on('close', () => stream?.close());
    }
  );
}