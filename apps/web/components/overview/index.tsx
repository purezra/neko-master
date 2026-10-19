"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { TopDomainsSimple } from "./top-domains-simple";
import { TopProxiesSimple } from "./top-proxies-simple";
import { TopCountriesSimple } from "./top-countries-simple";
import { EntityTrendDialog, type TrendEntity } from "./entity-trend-dialog";
import { getEntityTrendRange } from "@/lib/entity-trend";
import { TrafficTrendChart } from "@/components/features/stats/charts/trend-chart";
import { useStatsWebSocket } from "@/lib/websocket";
import { useTrafficTrend } from "@/hooks/api/use-traffic-trend";
import { type TimeRange } from "@/lib/api";
import { getTrafficTrendQueryKey } from "@/lib/stats-query-keys";
import type { TimePreset } from "@/lib/types/dashboard";
import type {
  DomainStats,
  ProxyStats,
  CountryStats,
  TrafficTrendPoint,
  StatsSummary,
} from "@neko-master/shared";

type TrendTimeRange = "30m" | "1h" | "24h" | "today";
type TrendGranularity = "minute" | "day";
export type GlobalTimePreset = TimePreset;

interface OverviewTabProps {
  domains: DomainStats[];
  proxies: ProxyStats[];
  countries: CountryStats[];
  timeRange: TimeRange;
  timePreset: TimePreset;
  activeBackendId?: number;
  autoRefresh?: boolean;
  onNavigate?: (tab: string) => void;
  backendStatus?: "healthy" | "unhealthy" | "unknown";
  isLoading?: boolean;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REALTIME_END_TOLERANCE_MS = 2 * 60 * 1000;
const TREND_WS_MIN_PUSH_MS = 3_000;

function parseIsoDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getMinuteBucket(durationMs: number): number {
  if (durationMs <= 2 * ONE_HOUR_MS) return 1;
  if (durationMs <= 6 * ONE_HOUR_MS) return 2;
  if (durationMs <= 12 * ONE_HOUR_MS) return 5;
  return 10;
}

function getTrendQuickOptions(durationMs: number, isToday = false): TrendTimeRange[] {
  const options: TrendTimeRange[] = [];
  if (durationMs >= THIRTY_MINUTES_MS) options.push("30m");
  if (durationMs >= ONE_HOUR_MS) options.push("1h");
  if (durationMs >= ONE_DAY_MS) options.push("24h");
  if (isToday) options.push("today");
  return options;
}

function getQuickRangeMinutes(range: TrendTimeRange): number {
  if (range === "30m") return 30;
  if (range === "1h") return 60;
  if (range === "today") {
    // Calculate minutes from midnight to now
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return Math.round((now.getTime() - midnight.getTime()) / 60000);
  }
  return 1440;
}

function parseTrendPointTime(value: string): Date | null {
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getTrendDataSpanMs(points: TrafficTrendPoint[]): number {
  if (points.length <= 1) return 0;
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const date = parseTrendPointTime(point.time);
    if (!date) continue;
    const ts = date.getTime();
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return 0;
  return Math.max(0, maxTs - minTs);
}

export function OverviewTab({
  domains,
  proxies,
  countries,
  timeRange,
  timePreset,
  activeBackendId,
  autoRefresh = true,
  onNavigate,
  backendStatus = "unknown",
  isLoading,
}: OverviewTabProps) {
  const dashboardT = useTranslations("dashboard");
  const queryClient = useQueryClient();
  const [domainSort, setDomainSort] = useState<"traffic" | "connections">("traffic");
  const [proxySort, setProxySort] = useState<"traffic" | "connections">("traffic");
  const [countrySort, setCountrySort] = useState<"traffic" | "connections">("traffic");
  const [selectedTrend, setSelectedTrend] = useState<(TrendEntity & { backendId: number }) | null>(null);
  const entityTrendRange = getEntityTrendRange(timePreset, timeRange);
  const openEntityTrend = (dimension: TrendEntity["dimension"], value: string) => {
    if (activeBackendId && entityTrendRange) setSelectedTrend({ dimension, value, backendId: activeBackendId });
  };

  // Traffic trend state
  const [trendChoice, setTrendTimeRange] = useState<TrendTimeRange>("24h");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [autoRefresh]);
  const [, startTransition] = useTransition();

  const parsedRange = useMemo(() => {
    const end = parseIsoDate(timeRange.end) ?? new Date(now);
    const start = parseIsoDate(timeRange.start) ?? new Date(end.getTime() - ONE_DAY_MS);
    if (start > end) {
      return { start: end, end };
    }
    return { start, end };
  }, [timeRange.end, timeRange.start, now]);

  const globalDurationMs = useMemo(
    () => Math.max(60 * 1000, parsedRange.end.getTime() - parsedRange.start.getTime()),
    [parsedRange.end, parsedRange.start],
  );

  const isLatestWindow = useMemo(
    () => parsedRange.end.getTime() >= now - REALTIME_END_TOLERANCE_MS,
    [parsedRange.end, now],
  );

  const canUseTrendSelector = useMemo(
    () =>
      timePreset !== "custom" &&
      isLatestWindow &&
      globalDurationMs >= THIRTY_MINUTES_MS &&
      globalDurationMs <= ONE_DAY_MS,
    [timePreset, isLatestWindow, globalDurationMs],
  );

  const trendTimeOptions = useMemo(
    () => (canUseTrendSelector ? getTrendQuickOptions(globalDurationMs, timePreset === "today") : []),
    [canUseTrendSelector, globalDurationMs, timePreset],
  );

  const trendTimeRange = canUseTrendSelector && !trendTimeOptions.includes(trendChoice)
    ? trendTimeOptions[trendTimeOptions.length - 1] ?? "30m" : trendChoice;
  const fallbackKey = JSON.stringify([activeBackendId, timeRange.start, timeRange.end, trendTimeRange]);
  const [sparseFallbackKey, setSparseFallbackKey] = useState<string | null>(null);
  const forceMinuteGranularity = sparseFallbackKey === fallbackKey;

  const trendQuery = useMemo(() => {
    const queryEnd = parsedRange.end;
    let queryStart = parsedRange.start;

    if (canUseTrendSelector) {
      if (trendTimeRange === "today") {
        // For "today", use midnight as start time
        const midnight = new Date(queryEnd);
        midnight.setHours(0, 0, 0, 0);
        queryStart = midnight;
      } else {
        const minutes = getQuickRangeMinutes(trendTimeRange);
        queryStart = new Date(queryEnd.getTime() - minutes * 60 * 1000);
      }
    }

    if (queryStart > queryEnd) {
      queryStart = queryEnd;
    }

    const durationMs = Math.max(60 * 1000, queryEnd.getTime() - queryStart.getTime());
    let granularity: TrendGranularity = durationMs > ONE_DAY_MS ? "day" : "minute";
    
    // Override granularity if forced (when sparse data is detected)
    if (forceMinuteGranularity) {
        granularity = "minute";
    }

    const bucketMinutes = granularity === "day" ? 24 * 60 : getMinuteBucket(durationMs);
    const tzOffsetMinutes = granularity === "day" ? -queryStart.getTimezoneOffset() : undefined;
    const minutes = Math.max(1, Math.ceil(durationMs / 60000));
    const realtime = isLatestWindow;

    return {
      start: queryStart.toISOString(),
      end: queryEnd.toISOString(),
      durationMs,
      minutes,
      bucketMinutes,
      tzOffsetMinutes,
      granularity,
      realtime,
    };
  }, [parsedRange.end, parsedRange.start, canUseTrendSelector, trendTimeRange, forceMinuteGranularity, isLatestWindow]);


  const wsTrendEnabled = autoRefresh && !!activeBackendId && canUseTrendSelector && trendQuery.realtime;
  const { status: wsTrendStatus } = useStatsWebSocket({
    backendId: activeBackendId,
    range: { start: trendQuery.start, end: trendQuery.end },
    minPushIntervalMs: TREND_WS_MIN_PUSH_MS,
    includeSummary: false,
    includeTrend: wsTrendEnabled,
    trendMinutes: trendQuery.minutes,
    trendBucketMinutes: trendQuery.bucketMinutes,
    trackLastMessage: false,
    enabled: wsTrendEnabled,
    onMessage: useCallback((stats: StatsSummary) => {
      if (!stats.trendStats) return;
      
      // Update Query Cache directly
      const queryKey = getTrafficTrendQueryKey(
        activeBackendId, 
        trendQuery.minutes, 
        trendQuery.bucketMinutes, 
        { start: trendQuery.start, end: trendQuery.end },
        trendQuery.tzOffsetMinutes
      );
      
      queryClient.setQueryData(queryKey, stats.trendStats);
    }, [activeBackendId, trendQuery, queryClient]),
  });
  const wsTrendConnected = wsTrendStatus === "connected";

  // Use the new hook for data fetching
  const { data: trendData, isLoading: trendLoading, isFetching: trendFetching, isPlaceholderData: trendPlaceholder } = useTrafficTrend({
    activeBackendId,
    minutes: trendQuery.minutes,
    bucketMinutes: trendQuery.bucketMinutes,
    tzOffsetMinutes: trendQuery.tzOffsetMinutes,
    range: { start: trendQuery.start, end: trendQuery.end },
    enabled: !!activeBackendId,
    refetchInterval: wsTrendEnabled && wsTrendConnected ? 90000 : false,
  });

  // Only choose the sparse-data fallback from this range's completed daily result.
  if (!trendLoading && !trendPlaceholder && trendQuery.granularity === "day" &&
      trendData && trendData.length > 0 && trendData.length <= 2 && getTrendDataSpanMs(trendData) <= ONE_DAY_MS &&
      !forceMinuteGranularity) {
    setSparseFallbackKey(fallbackKey);
  }

  // Handle time range change with transition
  const handleTimeRangeChange = (range: TrendTimeRange) => {
    if (range === trendTimeRange) return;
    startTransition(() => {
      setTrendTimeRange(range);
      setSparseFallbackKey(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Traffic Trend Chart - Full width */}
      <TrafficTrendChart 
        data={trendData || []}
        granularity={trendQuery.granularity}
        bucketMinutes={trendQuery.bucketMinutes}
        rangeEnd={trendQuery.end}
        timeRange={canUseTrendSelector ? trendTimeRange : undefined}
        timeRangeOptions={trendTimeOptions}
        onTimeRangeChange={canUseTrendSelector ? handleTimeRangeChange : undefined}
        isLoading={isLoading || trendLoading || (trendFetching && (!trendData || trendData.length === 0))}
        emptyHint={backendStatus === "unhealthy" ? dashboardT("backendUnavailableHint") : undefined}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Domains */}
        <TopDomainsSimple 
          domains={domains} 
          sortBy={domainSort}
          onSortChange={setDomainSort}
          onViewAll={() => onNavigate?.("domains")}
          onSelect={entityTrendRange && activeBackendId ? value => openEntityTrend("domain", value) : undefined}
          isLoading={isLoading}
        />
        
        {/* Top Proxies */}
        <TopProxiesSimple 
          proxies={proxies}
          sortBy={proxySort}
          onSortChange={setProxySort}
          onViewAll={() => onNavigate?.("proxies")}
          onSelect={entityTrendRange && activeBackendId ? value => openEntityTrend("proxy", value) : undefined}
          isLoading={isLoading}
        />
        
        {/* Top Countries */}
        <TopCountriesSimple 
          countries={countries}
          sortBy={countrySort}
          onSortChange={setCountrySort}
          onViewAll={() => onNavigate?.("countries")}
          onSelect={entityTrendRange && activeBackendId ? value => openEntityTrend("country", value) : undefined}
          isLoading={isLoading}
        />
      </div>
      {selectedTrend && entityTrendRange && selectedTrend.backendId === activeBackendId && <EntityTrendDialog
        entity={selectedTrend} backendId={activeBackendId} range={entityTrendRange} onClose={() => setSelectedTrend(null)}
      />}
    </div>
  );
}
