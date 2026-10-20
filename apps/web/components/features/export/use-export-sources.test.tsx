import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { getDomainsTopQueryKey, getIPsTopQueryKey, getSummaryQueryKey, getDeviceTrafficDetailsQueryKey } from "@/lib/stats-query-keys";
import { useExportSources, type UseExportSourcesParams, type UseExportSourcesResult } from "./use-export-sources";

vi.mock("@/lib/api", () => ({ api: {
  getSummary: vi.fn(), getCountries: vi.fn(), getRules: vi.fn(), getProxies: vi.fn(),
  getDevices: vi.fn(), getDomains: vi.fn(), getIPs: vi.fn(), getDeviceTrafficDetails: vi.fn(),
} }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const range = { start: "2026-10-17T08:00:00.000Z", end: "2026-10-17T08:59:59.999Z", persistedOnly: true };
const disabled = { summary: false, domains: false, ips: false, rules: false, countries: false, proxies: false, devices: false };
const clients: QueryClient[] = [];

afterEach(() => { clients.forEach((client) => client.clear()); clients.length = 0; vi.clearAllMocks(); });

function setup(enabled: UseExportSourcesParams["enabled"], extra: Partial<UseExportSourcesParams> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return { client, render: () => {
    let result: UseExportSourcesResult | undefined;
    function Probe() {
      result = useExportSources({ backendId: 1, timeRange: range, topN: 10, enabled, ...extra });
      return null;
    }
    renderToString(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    return result!;
  } };
}

describe("selected export queries", () => {
  it("derives scoped device usage from filtered facts without fetching global device totals", async () => {
    const filters = { groupName: "Home" };
    const { client, render } = setup({ ...disabled, devices: true }, { scoped: true, deviceFilters: filters });
    const row = { sourceIP: "192.168.1.2", domain: "sample.test", ip: "203.0.113.1", rule: "Group", chain: "Node > Group", totalUpload: 12, totalDownload: 34, totalConnections: 1, lastSeen: range.start };
    vi.mocked(api.getDeviceTrafficDetails).mockResolvedValue({ rows: [row, row], hasMore: false });
    await render().refetch();
    expect(api.getDevices).not.toHaveBeenCalled();
    expect(api.getDeviceTrafficDetails).toHaveBeenCalledWith(1, range, 0, 1000, filters);
    expect(client.getQueryData(getDeviceTrafficDetailsQueryKey(1, range, filters))).toHaveLength(2);
    expect(render().sources.devices[0]).toMatchObject({ totalUpload: 24, totalDownload: 68, totalConnections: 2 });
  });
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

  it("loads all detail pages and blocks a partial export on a later page failure", async () => {
    const { client, render } = setup({ ...disabled, deviceDetails: true });
    vi.mocked(api.getDeviceTrafficDetails).mockResolvedValueOnce({ rows: [], hasMore: true }).mockRejectedValueOnce(new Error("second page failed"));
    const result = await render().refetch();
    expect(result).toBeUndefined();
    expect(api.getDeviceTrafficDetails).toHaveBeenNthCalledWith(1, 1, range, 0, 1000, undefined);
    expect(api.getDeviceTrafficDetails).toHaveBeenNthCalledWith(2, 1, range, 1000, 1000, undefined);
    const state = client.getQueryState(getDeviceTrafficDetailsQueryKey(1, range));
    expect(state?.error?.message).toBe("second page failed");
    expect(state?.data).toBeUndefined();
  });

  it("does not reuse details across gateways or time ranges", () => {
    expect(getDeviceTrafficDetailsQueryKey(1, range)).not.toEqual(getDeviceTrafficDetailsQueryKey(2, range));
    expect(getDeviceTrafficDetailsQueryKey(1, range)).not.toEqual(getDeviceTrafficDetailsQueryKey(1, { ...range, end: range.start }));
  });

  it("fails explicitly at the detail limit instead of returning a partial dataset", async () => {
    const { client, render } = setup({ ...disabled, deviceDetails: true });
    vi.mocked(api.getDeviceTrafficDetails).mockResolvedValue({ rows: [], hasMore: true });
    await render().refetch();
    expect(api.getDeviceTrafficDetails).toHaveBeenCalledTimes(100);
    const state = client.getQueryState(getDeviceTrafficDetailsQueryKey(1, range));
    expect(state?.error?.message).toBe("detailLimit");
    expect(state?.data).toBeUndefined();
  });
});
