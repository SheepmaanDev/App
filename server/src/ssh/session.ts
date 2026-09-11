import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Client as Ssh2Client } from 'ssh2';

const run = promisify(exec);

/** Resultat d'une commande executee sur l'hote via SSH. */
export interface SshExecResult {
  output: string;
  code: number | null;
}

/** Session SSH ouverte vers 127.0.0.1 (le serveur sshd de la machine). */
export interface SshSession {
  exec(command: string): Promise<SshExecResult>;
  end(): void;
}

/** Fabrique injectable pour les tests. */
export interface SshSessionFactory {
  connect(user: string, password: string, port: number): Promise<SshSession>;
}

/** Erreur de connexion SSH, avec message pret a afficher. */
export class SshConnectError extends Error {}

export function sshErrorMessage(err: Error): string {
  const level = (err as { level?: string }).level;
  if (level === 'client-authentication') {
    return 'Identifiants SSH refusés par la machine.';
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(err.message)) {
    return 'Serveur SSH injoignable sur 127.0.0.1 — vérifie que sshd tourne et que le port est correct.';
  }
  return err.message;
}

/** Implementation reelle : client ssh2 (pur JS) vers localhost:port. */
export function createSshSessionFactory(): SshSessionFactory {
  return {
    async connect(user, password, port): Promise<SshSession> {
      const { Client } = await import('ssh2');
      const conn: Ssh2Client = new Client();
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error): void => {
          conn.end();
          reject(new SshConnectError(sshErrorMessage(err)));
        };
        conn.once('ready', () => {
          conn.removeListener('error', onError);
          resolve();
        });
        conn.once('error', onError);
        conn.connect({
          host: '127.0.0.1',
          port,
          username: user,
          password,
          readyTimeout: 8000,
          keepaliveInterval: 15000
        });
      });

      // Les commandes sont serialisees : une seule a la fois par session.
      let busy = false;
      const session: SshSession = {
        async exec(command: string): Promise<SshExecResult> {
          if (busy) throw new Error('Une commande est déjà en cours.');
          busy = true;
          try {
            return await new Promise<SshExecResult>((resolve, reject) => {
              conn.exec(command, (err, stream) => {
                if (err) {
                  busy = false;
                  return reject(err);
                }
                let output = '';
                stream.on('data', (d: Buffer) => {
                  output += d.toString('utf8');
                });
                stream.stderr.on('data', (d: Buffer) => {
                  output += d.toString('utf8');
                });
                stream.on('close', (code: number | null) => {
                  busy = false;
                  resolve({ output, code });
                });
              });
            });
          } catch (err) {
            busy = false;
            throw err;
          }
        },
        end() {
          conn.end();
        }
      };
      return session;
    }
  };
}