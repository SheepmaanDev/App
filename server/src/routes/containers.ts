import type { FastifyInstance } from 'fastify';
import { DockerNotFoundError, type DockerClient } from '../docker/types.js';

interface ContainerParams {
  id: string;
}

function decodeId(raw: string): string {
  return decodeURIComponent(raw).replace(/^\//, '');
}

type ContainerAction = 'start' | 'stop' | 'restart';

export function registerContainerRoutes(
  app: FastifyInstance,
  docker: DockerClient
): void {
  app.get<{ Querystring: { all?: string } }>('/containers', async (request) => {
    // Par defaut on liste tout (y compris arretes) ; ?all=false -> running uniquement.
    const all = request.query.all !== 'false';
    const containers = await docker.listContainers(all);
    return { containers, count: containers.length };
  });

  app.get<{ Params: ContainerParams }>('/containers/:id', async (request, reply) => {
    const id = decodeId(request.params.id);
    const container = await docker.getContainer(id);
    if (!container) {
      return reply.code(404).send({ error: 'not_found', id });
    }
    return { container };
  });

  app.get<{ Params: ContainerParams; Querystring: { tail?: string } }>(
    '/containers/:id/logs',
    async (request, reply) => {
      const id = decodeId(request.params.id);
      const raw = Number(request.query.tail ?? 200);
      const tail = Number.isFinite(raw)
        ? Math.max(1, Math.min(1000, Math.floor(raw)))
        : 200;
      try {
        const logs = await docker.getContainerLogs(id, tail);
        return { container: id, tail, logs };
      } catch (error) {
        if (error instanceof DockerNotFoundError) {
          return reply.code(404).send({ error: 'not_found', id });
        }
        throw error;
      }
    }
  );

  app.get<{ Params: ContainerParams }>('/containers/:id/stats', async (request, reply) => {
    const id = decodeId(request.params.id);
    try {
      const stats = await docker.getContainerStats(id);
      return { container: id, stats };
    } catch (error) {
      if (error instanceof DockerNotFoundError) {
        return reply.code(404).send({ error: 'not_found', id });
      }
      throw error;
    }
  });

  const registerAction = (action: ContainerAction) => {
    app.post<{ Params: ContainerParams }>(
      `/containers/:id/${action}`,
      async (request, reply) => {
        const id = decodeId(request.params.id);
        try {
          await docker[`${action}Container`](id);
          const container = await docker.getContainer(id);
          return { ok: true, action, id, state: container?.state ?? 'unknown' };
        } catch (error) {
          if (error instanceof DockerNotFoundError) {
            return reply.code(404).send({ error: 'not_found', id });
          }
          throw error;
        }
      }
    );
  };

  registerAction('start');
  registerAction('stop');
  registerAction('restart');
}