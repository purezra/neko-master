import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { getDomainsTopQueryKey, getIPsTopQueryKey, getSummaryQueryKey } from "@/lib/stats-query-keys";
import { useExportSources, type UseExportSourcesParams, type UseExportSourcesResult } from "./use-export-sources";

vi.mock("@/lib/api", () => ({ api: {
  getSummary: vi.fn(), getCountries: vi.fn(), getRules: vi.fn(), getProxies: vi.fn(),
  getDevices: vi.fn(), getDomains: vi.fn(), getIPs: vi.fn(),
} }));

const range = { start: "2026-10-17T08:00:00.000Z", end: "2026-10-17T08:59:59.999Z", persistedOnly: true };
const disabled = { summary: false, domains: false, ips: false, rules: false, countries: false, proxies: false, devices: false };
const clients: QueryClient[] = [];

afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; vi.clearAllMocks(); });

function setup(enabled: UseExportSourcesParams["enabled"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return { client, render: () => {
    let result: UseExportSourcesResult | undefined;
    function Probe() {
      result = useExportSources({ backendId: 1, timeRange: range, topN: 10, enabled });
      return null;
    }
    renderToString(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    return result!;
  } };
}

describe("selected export queries", () => {
  it("blocks export while a selected dataset has not loaded", () => {
    expect(setup({ ...disabled, domains: true }).render().isLoading).toBe(true);
  });

  it("does not let an unselected error block ready data or participate in retries", async () => {
    const { client, render } = setup({ ...disabled, domains: true });
    client.setQueryData(getDomainsTopQueryKey(1, 10, range), { data: [], total: 0 });
    client.getQueryCache().build(client, { queryKey: getIPsTopQueryKey(1, 10, range) }).setState({
      status: "error", error: new Error("IP request failed"),
    });
    const result = render();
    expect(result.error).toBeNull();
    expect(result.isLoading).toBe(false);
    vi.mocked(api.getDomains).mockResolvedValue({ data: [], total: 0 });
    await result.refetch();
    expect(api.getIPs).not.toHaveBeenCalled();
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it("requests both rankings by total traffic and preserves the inclusive API boundary", async () => {
    const { render } = setup({ ...disabled, domains: true, ips: true });
    vi.mocked(api.getDomains).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(api.getIPs).mockResolvedValue({ data: [], total: 0 });
    await render().refetch();
    const expected = { limit: 10, sortBy: "totalTraffic", sortOrder: "desc", ...range };
    expect(api.getDomains).toHaveBeenCalledWith(1, expected);
    expect(api.getIPs).toHaveBeenCalledWith(1, expected);
  });

  it("isolates export summaries from live dashboard cache entries", () => {
    expect(getSummaryQueryKey(1, range)).not.toEqual(getSummaryQueryKey(1, { start: range.start, end: range.end }));
  });
});
