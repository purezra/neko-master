import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, createTestBackend } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { RealtimeStore } from '../realtime/realtime.store.js';
import type { StatsDatabase } from '../db/db.js';
import type { Connection } from '@neko-master/shared';

const proxies = {
  'Twitter / 组': { name: 'Twitter / 组', type: 'Selector', now: 'HK / 01', all: ['HK / 01', 'JP'] },
  Auto: { name: 'Auto', type: 'URLTest', now: 'JP', all: ['JP'] },
  'HK / 01': { name: 'HK / 01', type: 'Shadowsocks' },
  JP: { name: 'JP', type: 'VLESS' }, DIRECT: { name: 'DIRECT', type: 'Direct' },
};

describe('gateway diagnostics API', () => {
  let app: FastifyInstance;
  let db: StatsDatabase;
  let cleanup: () => void;
  let backendId: number;
  let store: RealtimeStore;
  let fetchMock: ReturnType<typeof vi.fn>;
  const url = (path: string, extra = '') => `/api/gateway/diagnostics/${path}?backendId=${backendId}${extra}`;

  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase());
    backendId = createTestBackend(db);
    db.updateBackend(backendId, { token: 'gateway-test-secret' });
    store = new RealtimeStore();
    fetchMock = vi.fn(async (target: string, options?: RequestInit) => options?.method === 'PUT' || options?.method === 'DELETE'
      ? new Response(null, { status: 204 }) : Response.json(target.endsWith('/providers/proxies') ? { providers: {} } : { proxies }));
    vi.stubGlobal('fetch', fetchMock);
    app = await createApp({ port: 0, db, realtimeStore: store, autoListen: false });
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    cleanup();
  });

  it('requires an explicit valid backend and a whole minute window from 1 to 5', async () => {
    expect((await app.inject('/api/gateway/diagnostics/connections')).statusCode).toBe(400);
    for (const minutes of ['0', '6', '1.5', 'NaN']) {
      expect((await app.inject(url('connections', `&minutes=${minutes}`))).statusCode).toBe(400);
    }
    expect((await app.inject('/api/gateway/diagnostics/connections?backendId=9999')).statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns zero-byte observations and never crosses backends', async () => {
    store.recentConnections.observe(backendId, [{ id: 'zero', metadata: { host: 'x.com' }, chains: ['JP', 'Twitter / 组'], upload: 0, download: 0 } as Connection]);
    const another = createTestBackend(db, 'second');
    const result = await app.inject(url('connections', '&minutes=1&search=x.com'));
    expect(result.json()).toMatchObject({ total: 1, connections: [{ id: 'zero', host: 'x.com', download: 0 }] });
    expect((await app.inject(`/api/gateway/diagnostics/connections?backendId=${another}`)).json().total).toBe(0);
    expect(result.headers['cache-control']).toBe('no-store');
    store.clearBackend(backendId);
    expect((await app.inject(url('connections'))).json().total).toBe(0);
  });

  it('reads the loaded configuration with server-side credentials and a timeout', async () => {
    expect((await app.inject(url('proxies'))).json()).toMatchObject({ proxies, canControl: true, nodes: [{ name: 'HK / 01' }, { name: 'JP' }] });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9090/proxies', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer gateway-test-secret' }), signal: expect.any(AbortSignal),
    }));
  });

  it('only switches a valid member of a Selector, encoding group names', async () => {
    for (const body of [{ group: 'Auto', name: 'JP' }, { group: 'Twitter / 组', name: 'missing' }]) {
      expect((await app.inject({ method: 'PUT', url: url('selection'), payload: body })).statusCode).toBe(400);
    }
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
    expect((await app.inject({ method: 'PUT', url: url('selection'), payload: { group: 'Twitter / 组', name: 'JP' } })).statusCode).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(`http://127.0.0.1:9090/proxies/${encodeURIComponent('Twitter / 组')}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'JP' }) }));
  });

  it('disconnects only the requested connection', async () => {
    expect((await app.inject({ method: 'DELETE', url: url('connection'), payload: { id: 'a/b' } })).statusCode).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith('http://127.0.0.1:9090/connections/a%2Fb', expect.objectContaining({ method: 'DELETE' }));
  });

  it('runs health checks in the background, reports partial failures and rejects duplicate jobs', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    fetchMock.mockImplementation(async (target: string) => {
      if (target.includes('/delay?')) {
        await pending;
        return target.includes('/JP/') ? new Response(null, { status: 504 }) : Response.json({ delay: 123 });
      }
      return Response.json(target.endsWith('/providers/proxies') ? { providers: {} } : { proxies });
    });
    const start = await app.inject({ method: 'POST', url: url('healthcheck'), payload: {} });
    expect(start.json()).toMatchObject({ running: true, total: 2, results: [] });
    expect((await app.inject({ method: 'POST', url: url('healthcheck'), payload: {} })).statusCode).toBe(429);
    release();
    await vi.waitFor(async () => expect((await app.inject(url('healthcheck'))).json().running).toBe(false));
    const state = (await app.inject(url('healthcheck'))).json();
    expect(state.results).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'HK / 01', delay: 123 }), expect.objectContaining({ name: 'JP', delay: null })]));
    expect(fetchMock.mock.calls.filter(([target]) => target.includes('/delay?'))).toHaveLength(2);
    const other = createTestBackend(db, 'another');
    expect((await app.inject(`/api/gateway/diagnostics/healthcheck?backendId=${other}`)).json().startedAt).toBeNull();
  });

  it('blocks control in showcase mode, including direct API calls', async () => {
    vi.stubEnv('SHOWCASE_SITE_MODE', 'true');
    expect((await app.inject(url('proxies'))).json().canControl).toBe(false);
    fetchMock.mockClear();
    for (const [method, path, payload] of [
      ['PUT', 'selection', { group: 'Twitter / 组', name: 'JP' }],
      ['POST', 'healthcheck', {}], ['DELETE', 'connection', { id: 'one' }],
    ] as const) {
      expect((await app.inject({ method, url: url(path), payload })).statusCode).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('includes provider-only nodes, distinguishes duplicate names and tests the correct provider endpoint', async () => {
    fetchMock.mockImplementation(async (target: string) => {
      if (target.includes('/healthcheck?')) return Response.json({ delay: 81 });
      if (target.endsWith('/providers/proxies')) return Response.json({ providers: {
        'Subscription / A': { vehicleType: 'HTTP', proxies: [{ name: 'JP', type: 'VLESS' }, { name: 'Provider only', type: 'Trojan' }] },
        'Subscription B': { vehicleType: 'File', proxies: [{ name: 'JP', type: 'VLESS' }] },
        default: { vehicleType: 'Compatible', proxies: Object.values(proxies) },
      } });
      return Response.json({ proxies });
    });
    const config = (await app.inject(url('proxies'))).json();
    expect(config.nodes).toHaveLength(5);
    expect(config.nodes.filter((node: { name: string }) => node.name === 'JP')).toHaveLength(3);
    expect(config.proxies['Provider only'].type).toBe('Trojan');
    const nodeId = JSON.stringify(['Subscription / A', 'JP']);
    const response = await app.inject({ method: 'POST', url: url('healthcheck'), payload: { nodeId } });
    expect(response.statusCode).toBe(200);
    await vi.waitFor(async () => expect((await app.inject(url('healthcheck'))).json().running).toBe(false));
    const job = (await app.inject(url('healthcheck'))).json();
    expect(job.results).toEqual([{ id: nodeId, name: 'JP', delay: 81 }]);
    expect(fetchMock.mock.calls.some(([target]) => target.includes(`/providers/proxies/${encodeURIComponent('Subscription / A')}/JP/healthcheck?`))).toBe(true);
    expect(fetchMock.mock.calls.some(([target]) => target.includes('/proxies/JP/delay'))).toBe(false);
  });

  it('limits bulk test concurrency and lets another gateway run independently', async () => {
    let active = 0;
    let peak = 0;
    const nodes = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`node-${index}`, { name: `node-${index}`, type: 'VLESS' }]));
    fetchMock.mockImplementation(async (target: string) => {
      if (target.endsWith('/providers/proxies')) return Response.json({ providers: {} });
      if (!target.includes('/delay?')) return Response.json({ proxies: nodes });
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active--;
      return Response.json({ delay: 40 });
    });
    await app.inject({ method: 'POST', url: url('healthcheck'), payload: {} });
    await vi.waitFor(async () => expect((await app.inject(url('healthcheck'))).json().running).toBe(false));
    expect(peak).toBe(6);
    expect((await app.inject(url('healthcheck'))).json().results).toHaveLength(15);
    expect((await app.inject({ method: 'POST', url: url('healthcheck'), payload: { nodeId: 'missing' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: url('healthcheck'), payload: { nodeId: JSON.stringify([null, 'node-1']) } })).statusCode).toBe(200);
    const other = createTestBackend(db, 'independent');
    expect((await app.inject({ method: 'POST', url: `/api/gateway/diagnostics/healthcheck?backendId=${other}`, payload: {} })).statusCode).toBe(200);
    await vi.waitFor(async () => {
      expect((await app.inject(url('healthcheck'))).json().running).toBe(false);
      expect((await app.inject(`/api/gateway/diagnostics/healthcheck?backendId=${other}`)).json().running).toBe(false);
    });
  });

  it('inherits authentication and rejects unsupported agent or Surge backends', async () => {
    for (const change of [{ url: 'agent://test' }, { url: 'http://127.0.0.1:9090', type: 'surge' as const }]) {
      db.updateBackend(backendId, change);
      expect((await app.inject(url('proxies'))).statusCode).toBe(409);
    }
    db.updateAuthConfig({ enabled: true, tokenHash: 'not-a-valid-token-hash' });
    expect((await app.inject(url('connections'))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a retryable gateway error without forwarding credentials', async () => {
    fetchMock.mockRejectedValue(new Error('network offline'));
    const response = await app.inject(url('proxies'));
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('gateway-test-secret');
  });
});
