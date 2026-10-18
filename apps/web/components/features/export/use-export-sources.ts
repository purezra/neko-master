"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type TimeRange } from "@/lib/api";
import { useStableTimeRange } from "@/lib/hooks/use-stable-time-range";
import {
  getCountriesQueryKey,
  getDevicesQueryKey,
  getDomainsTopQueryKey,
  getIPsTopQueryKey,
  getProxiesQueryKey,
  getRulesQueryKey,
  getSummaryQueryKey,
} from "@/lib/stats-query-keys";
import type { StatsSummary } from "@neko-master/shared";
import type {
  ExportDatasetId,
  ExportSourceData,
} from "@/lib/export/dataset";

export interface UseExportSourcesParams {
  backendId?: number;
  timeRange?: TimeRange;
  topN: number;
  enabled: Record<ExportDatasetId, boolean>;
}

export interface UseExportSourcesResult {
  sources: ExportSourceData;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Shared queries are keyed exactly like the dashboard tabs so the export view
// reuses warm cache entries instead of re-fetching.
export function useExportSources({
  backendId,
  timeRange,
  topN,
  enabled,
}: UseExportSourcesParams): UseExportSourcesResult {
  const stableRange = useStableTimeRange(timeRange);
  const hasBackend = !!backendId && !!stableRange;

  const summaryQuery = useQuery({
    queryKey: getSummaryQueryKey(backendId, stableRange),
    queryFn: () => api.getSummary(backendId, stableRange),
    enabled: hasBackend && enabled.summary,
    staleTime: 15_000,
  });

  const countriesQuery = useQuery({
    queryKey: getCountriesQueryKey(backendId, topN, stableRange),
    queryFn: () => api.getCountries(backendId, topN, stableRange),
    enabled: hasBackend && enabled.countries,
    staleTime: 15_000,
  });

  const rulesQuery = useQuery({
    queryKey: getRulesQueryKey(backendId, topN, stableRange),
    queryFn: () => api.getRules(backendId, topN, stableRange),
    enabled: hasBackend && enabled.rules,
    staleTime: 15_000,
  });

  const proxiesQuery = useQuery({
    queryKey: getProxiesQueryKey(backendId, topN, stableRange),
    queryFn: () => api.getProxies(backendId, topN, stableRange),
    enabled: hasBackend && enabled.proxies,
    staleTime: 15_000,
  });

  const devicesQuery = useQuery({
    queryKey: getDevicesQueryKey(backendId, topN, stableRange),
    queryFn: () => api.getDevices(backendId, topN, stableRange),
    enabled: hasBackend && enabled.devices,
    staleTime: 15_000,
  });

  const domainsQuery = useQuery({
    queryKey: getDomainsTopQueryKey(backendId, topN, stableRange),
    queryFn: () =>
      api.getDomains(backendId, {
        limit: topN,
        sortBy: "totalTraffic",
        sortOrder: "desc",
        start: stableRange?.start,
        end: stableRange?.end,
        persistedOnly: stableRange?.persistedOnly,
      }),
    enabled: hasBackend && enabled.domains,
    staleTime: 15_000,
  });

  const ipsQuery = useQuery({
    queryKey: getIPsTopQueryKey(backendId, topN, stableRange),
    queryFn: () =>
      api.getIPs(backendId, {
        limit: topN,
        sortBy: "totalTraffic",
        sortOrder: "desc",
        start: stableRange?.start,
        end: stableRange?.end,
        persistedOnly: stableRange?.persistedOnly,
      }),
    enabled: hasBackend && enabled.ips,
    staleTime: 15_000,
  });

  const sources = useMemo<ExportSourceData>(
    () => ({
      summary: summaryQuery.data as StatsSummary | undefined,
      countries: countriesQuery.data ?? [],
      rules: rulesQuery.data ?? [],
      proxies: proxiesQuery.data ?? [],
      devices: devicesQuery.data ?? [],
      domains: domainsQuery.data?.data ?? [],
      ips: ipsQuery.data?.data ?? [],
    }),
    [
      summaryQuery.data,
      countriesQuery.data,
      rulesQuery.data,
      proxiesQuery.data,
      devicesQuery.data,
      domainsQuery.data,
      ipsQuery.data,
    ],
  );

  const queryByDataset = {
    summary: summaryQuery,
    countries: countriesQuery,
    rules: rulesQuery,
    proxies: proxiesQuery,
    devices: devicesQuery,
    domains: domainsQuery,
    ips: ipsQuery,
  };
  const queries = (Object.keys(queryByDataset) as ExportDatasetId[])
    .filter((id) => enabled[id] && hasBackend)
    .map((id) => queryByDataset[id]);
  const errorQuery = queries.find((query) => query.error);
  const isLoading = queries.some((query) => query.isPending || query.isFetching);

  const error = errorQuery?.error
    ? errorQuery.error instanceof Error
      ? errorQuery.error.message
      : String(errorQuery.error)
    : null;

  return {
    sources,
    isLoading,
    error,
    refetch: async () => {
      await Promise.all(queries.map((query) => query.refetch()));
    },
  };
}
