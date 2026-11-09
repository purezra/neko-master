import type { DiagnosticProxy, DiagnosticNode, DiagnosticHealthState } from '@neko-master/shared';
import { buildGatewayHeaders, getGatewayBaseUrl } from '@neko-master/shared';
import { gatewayFetch } from '../../shared/utils/gateway-fetch.js';

type Gateway = { url: string; token: string; type: 'clash' | 'surge' };
const TEST_URL = 'https://www.gstatic.com/generate_204';
const isNode = (proxy: DiagnosticProxy) => !proxy.all &&
  !['Direct', 'DIRECT', 'Reject', 'REJECT', 'RejectDrop', 'Compatible', 'Pass', 'PassRule'].includes(proxy.type);

export class DiagnosticsService {
  private checking = new Set<number>();
  private jobs = new Map<number, DiagnosticHealthState>();
  private shutdown = new AbortController();

  dispose(): void { this.shutdown.abort(); }

  healthState(backendId: number): DiagnosticHealthState {
    return this.jobs.get(backendId) ?? { running: false, total: 0, results: [], startedAt: null, finishedAt: null };
  }

  private async request(backend: Gateway, path: string, method = 'GET', body?: unknown): Promise<Response> {
    const response = await gatewayFetch(`${getGatewayBaseUrl(backend.url)}${path}`, {
      method, headers: { ...buildGatewayHeaders(backend), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(8_000)]),
    });
    if (!response.ok) throw new Error(`Gateway request failed (${response.status})`);
    return response;
  }

  async proxies(backend: Gateway): Promise<Record<string, DiagnosticProxy>> {
    const data = await (await this.request(backend, '/proxies')).json() as { proxies: Record<string, DiagnosticProxy> };
    if (!data.proxies || typeof data.proxies !== 'object' || Array.isArray(data.proxies)) {
      throw new Error('Invalid gateway proxy response');
    }
    return data.proxies;
  }

  async configuration(backend: Gateway): Promise<{ proxies: Record<string, DiagnosticProxy>; nodes: DiagnosticNode[] }> {
    const [proxies, response] = await Promise.all([
      this.proxies(backend), this.request(backend, '/providers/proxies'),
    ]);
    const data = await response.json() as { providers: Record<string, { vehicleType?: string; proxies: DiagnosticProxy[] }> };
    if (!data.providers || typeof data.providers !== 'object') throw new Error('Invalid proxy provider response');
    const nodes: DiagnosticNode[] = Object.entries(proxies).filter(([, proxy]) => isNode(proxy))
      .map(([name, proxy]) => ({ ...proxy, name, id: JSON.stringify([null, name]) }));
    for (const [provider, detail] of Object.entries(data.providers)) {
      // Compatible providers mirror ordinary configured proxies and policy groups.
      if (detail.vehicleType === 'Compatible' || !Array.isArray(detail.proxies)) continue;
      for (const proxy of detail.proxies) {
        if (!isNode(proxy)) continue;
        nodes.push({ ...proxy, provider, id: JSON.stringify([provider, proxy.name]) });
        if (!Object.hasOwn(proxies, proxy.name)) {
          Object.defineProperty(proxies, proxy.name, { value: proxy, enumerable: true, configurable: true });
        }
      }
    }
    return { proxies, nodes };
  }

  async select(backend: Gateway, group: string, name: string): Promise<boolean> {
    const proxies = await this.proxies(backend);
    const policy = Object.hasOwn(proxies, group) ? proxies[group] : undefined;
    if (policy?.type !== 'Selector' || !policy.all?.includes(name)) return false;
    await this.request(backend, `/proxies/${encodeURIComponent(group)}`, 'PUT', { name });
    return true;
  }

  async close(backend: Gateway, id: string): Promise<void> {
    await this.request(backend, `/connections/${encodeURIComponent(id)}`, 'DELETE');
  }

  async health(backendId: number, backend: Gateway, nodeId?: string): Promise<DiagnosticHealthState | null> {
    if (this.checking.has(backendId)) return null;
    this.checking.add(backendId);
    try {
      const { nodes } = await this.configuration(backend);
      const targets = nodes.filter(node => nodeId === undefined || node.id === nodeId);
      if (nodeId !== undefined && targets.length === 0) throw Object.assign(new Error('Unknown proxy node'), { statusCode: 400 });
      const job: DiagnosticHealthState = { running: true, total: targets.length, results: [], startedAt: Date.now(), finishedAt: null };
      this.jobs.set(backendId, job);
      let index = 0;
      // Return immediately; polling survives reverse-proxy request timeouts and tab reloads.
      void Promise.all(Array.from({ length: Math.min(6, targets.length) }, async () => {
        while (index < targets.length && !this.shutdown.signal.aborted) {
          const node = targets[index++];
          const path = node.provider === undefined ? `/proxies/${encodeURIComponent(node.name)}/delay`
            : `/providers/proxies/${encodeURIComponent(node.provider)}/${encodeURIComponent(node.name)}/healthcheck`;
          try {
            const data = await (await this.request(backend,
              `${path}?timeout=5000&url=${encodeURIComponent(TEST_URL)}`)).json() as { delay: number };
            job.results.push({ id: node.id, name: node.name, delay: Number.isFinite(data.delay) && data.delay > 0 ? data.delay : null });
          } catch {
            job.results.push({ id: node.id, name: node.name, delay: null });
          }
        }
      })).finally(() => {
        job.running = false;
        job.finishedAt = Date.now();
        this.checking.delete(backendId);
      });
      return job;
    } catch (error: unknown) {
      this.checking.delete(backendId);
      throw error;
    }
  }
}
