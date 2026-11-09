import type { FastifyPluginAsync, FastifyError } from 'fastify';
import { isAgentBackendUrl } from '@neko-master/shared';
import { DiagnosticsService } from './diagnostics.service.js';

export const diagnosticsController: FastifyPluginAsync = async (fastify) => {
  const service = new DiagnosticsService();
  fastify.addHook('onClose', async () => { service.dispose(); });
  const querySchema = {
    type: 'object', required: ['backendId'],
    properties: {
      backendId: { type: 'integer', minimum: 1 }, minutes: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
      search: { type: 'string', maxLength: 200 }, offset: { type: 'integer', minimum: 0, default: 0 },
    },
  };
  fastify.addHook('preHandler', async (request, reply) => {
    const { backendId } = request.query as { backendId: number };
    const backend = fastify.db.getBackend(backendId);
    if (!backend) return reply.code(404).send({ error: 'Backend not found' });
    if (backend.type !== 'clash' || isAgentBackendUrl(backend.url)) {
      return reply.code(409).send({ error: 'Diagnostics requires a directly connected Clash/Mihomo backend' });
    }
    if (request.method !== 'GET' && fastify.authService.isShowcaseMode()) {
      return reply.code(403).send({ error: 'Gateway control is disabled in showcase mode' });
    }
    reply.header('Cache-Control', 'no-store');
  });
  fastify.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error.validation || error.statusCode === 400) return reply.code(400).send({ error: error.message });
    request.log.warn({ err: error }, 'Gateway diagnostics request failed');
    return reply.code(502).send({ error: 'Failed to reach gateway' });
  });
  fastify.get('/connections', { schema: { querystring: querySchema } }, async (request) => {
    const { backendId, minutes, search, offset } = request.query as { backendId: number; minutes: number; search?: string; offset: number };
    return fastify.realtimeStore.recentConnections.query(backendId, minutes, search, offset);
  });
  fastify.get('/proxies', { schema: { querystring: querySchema } }, async (request) => {
    const { backendId } = request.query as { backendId: number };
    return { ...await service.configuration(fastify.db.getBackend(backendId)!), canControl: !fastify.authService.isShowcaseMode() };
  });
  fastify.get('/healthcheck', { schema: { querystring: querySchema } }, async (request) => {
    const { backendId } = request.query as { backendId: number };
    return service.healthState(backendId);
  });
  fastify.put('/selection', { schema: { querystring: querySchema, body: {
    type: 'object', required: ['group', 'name'], additionalProperties: false,
    properties: { group: { type: 'string', minLength: 1, maxLength: 500 }, name: { type: 'string', minLength: 1, maxLength: 500 } },
  } } }, async (request, reply) => {
    const { backendId } = request.query as { backendId: number };
    const { group, name } = request.body as { group: string; name: string };
    if (!await service.select(fastify.db.getBackend(backendId)!, group, name)) {
      return reply.code(400).send({ error: 'Select a valid member of a Selector group' });
    }
    return { ok: true };
  });
  fastify.post('/healthcheck', { schema: { querystring: querySchema, body: {
    type: 'object', additionalProperties: false, properties: { nodeId: { type: 'string', minLength: 1, maxLength: 1500 } },
  } } }, async (request, reply) => {
    const { backendId } = request.query as { backendId: number };
    const { nodeId } = (request.body ?? {}) as { nodeId?: string };
    const job = await service.health(backendId, fastify.db.getBackend(backendId)!, nodeId);
    if (job === null) return reply.code(429).send({ error: 'A health check is already running' });
    return job;
  });
  fastify.delete('/connection', { schema: { querystring: querySchema, body: {
    type: 'object', required: ['id'], additionalProperties: false, properties: { id: { type: 'string', minLength: 1, maxLength: 500 } },
  } } }, async (request) => {
    const { backendId } = request.query as { backendId: number };
    const { id } = request.body as { id: string };
    await service.close(fastify.db.getBackend(backendId)!, id);
    return { ok: true };
  });
};
