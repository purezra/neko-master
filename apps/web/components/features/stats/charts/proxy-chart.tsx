"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { useTranslations } from "next-intl";
import { useThemePalette } from "@/lib/hooks/use-theme-palette";
import { BarChart3 } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Favicon } from "@/components/common";
import { formatBytes } from "@/lib/utils";
import { api, type TimeRange } from "@/lib/api";
import { useStableTimeRange } from "@/lib/hooks/use-stable-time-range";
import { getDomainsQueryKey } from "@/lib/stats-query-keys";
import type { DomainStats } from "@neko-master/shared";

interface TopDomainsChartProps {
  data?: DomainStats[];
  activeBackendId?: number;
  timeRange?: TimeRange;
}

const TOP_OPTIONS = [10, 20, 50, 100] as const;
type TopOption = (typeof TOP_OPTIONS)[number];

// Dynamic height configuration based on topN
const CHART_CONFIG = {
  10: { height: 350, barSize: 32, showAllLabels: true },
  20: { height: 450, barSize: 24, showAllLabels: true },
  50: { height: 700, barSize: 18, showAllLabels: true },
  100: { height: 1200, barSize: 14, showAllLabels: true },
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Custom label renderer to prevent text wrapping in SVG
function renderCustomBarLabel(props: import("recharts").LabelProps) {
  const { x, y, width, value, height } = props;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") return <></>;
  return (
    <text
      x={x + width + 5}
      y={y + height / 2}
      fill="currentColor"
      fontSize={10}
      dominantBaseline="central"
      textAnchor="start"
      style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatBytes(Number(value) || 0, 0)}
    </text>
  );
}

export function TopDomainsChart({ data, activeBackendId, timeRange }: TopDomainsChartProps) {
  const t = useTranslations("domains");
  const { chartColors: DOMAIN_COLORS } = useThemePalette();
  const commonT = useTranslations("stats");
  const [topN, setTopN] = useState<TopOption>(10);
  // Track whether this is the initial render to only animate on first load
  const [hasRendered, setHasRendered] = useState(false);
  // Track container width to hide labels on small screens
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const stableTimeRange = useStableTimeRange(timeRange);

  const domainsQuery = useQuery({
    queryKey: getDomainsQueryKey(
      activeBackendId,
      {
        offset: 0,
        limit: topN,
        sortBy: "totalTraffic",
        sortOrder: "desc",
      },
      stableTimeRange,
    ),
    queryFn: () =>
      api.getDomains(activeBackendId, {
        offset: 0,
        limit: topN,
        sortBy: "totalTraffic",
        sortOrder: "desc",
        start: stableTimeRange?.start,
        end: stableTimeRange?.end,
      }),
    enabled: !data && !!activeBackendId,
    placeholderData: keepPreviousData,
  });

  const domains = useMemo(() => {
    const source = data ?? domainsQuery.data?.data ?? [];
    return [...source]
      .sort(
        (a, b) =>
          b.totalDownload +
          b.totalUpload -
          (a.totalDownload + a.totalUpload),
      )
      .slice(0, topN);
  }, [data, domainsQuery.data?.data, topN]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Show labels only when container is wide enough (> 400px)
  const showLabels = containerWidth > 400;

  // Get chart configuration based on topN
  const config = CHART_CONFIG[topN];
  // Keep room for the bars on narrow screens while allowing every domain to
  // wrap inside the SVG instead of overflowing past its left edge.
  const domainAxisWidth = Math.min(320, Math.max(110, containerWidth * 0.4));
  const domainLabelWidth = domainAxisWidth - 16;
  // The labels use a monospace font: reserve a little more than its ASCII
  // advance, and a full em for internationalized domain characters.
  const longestLabelWidth = Math.max(0, ...domains.map(({ domain }) =>
    Array.from(domain).reduce((width, char) => width + (char.charCodeAt(0) > 127 ? 11 : 7), 0),
  ));
  const rowHeight = Math.max(28, Math.ceil(longestLabelWidth / domainLabelWidth) * 16 + 12);
  const chartHeight = Math.max(config.height, domains.length * rowHeight + 50);

  const chartData = useMemo(() => {
    if (!domains || domains.length === 0) return [];
    const result = domains.map((domain: DomainStats, index: number) => ({
      baseColor: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
      name: domain.domain,
      fullDomain: domain.domain,
      total: domain.totalDownload + domain.totalUpload,
      download: domain.totalDownload,
      upload: domain.totalUpload,
    }));
    return result;
  }, [domains, DOMAIN_COLORS]);

  const hasData = chartData.length > 0;
  useEffect(() => {
    if (!hasData || hasRendered) return;
    const timer = setTimeout(() => setHasRendered(true), 800);
    return () => clearTimeout(timer);
  }, [hasData, hasRendered]);

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{payload?: unknown}> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as (typeof chartData)[number] | undefined;
      if (!item) return null;
      return (
        <div className="max-w-[min(24rem,calc(100vw-2rem))] bg-background border border-border p-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Favicon domain={item.fullDomain} size="sm" />
            <span className="min-w-0 break-all font-medium text-sm text-foreground">
              {item.fullDomain}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{commonT("total")}:</span>
              <span className="font-medium text-foreground">
                {formatBytes(item.total)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-blue-500">{commonT("download")}:</span>
              <span className="text-foreground">
                {formatBytes(item.download)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-purple-500">{commonT("upload")}:</span>
              <span className="text-foreground">
                {formatBytes(item.upload)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("topDomainsByTraffic")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("mostBandwidthConsuming")}
            </p>
          </div>
          <Tabs
            value={topN.toString()}
            onValueChange={(v) => setTopN(parseInt(v, 10) as TopOption)}>
            <TabsList className="h-8">
              {TOP_OPTIONS.map((n) => (
                <TabsTrigger
                  key={n}
                  value={n.toString()}
                  className="text-xs px-3">
                  Top {n}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent ref={containerRef}>
        <div 
          className="w-full min-w-0 transition-all duration-500 ease-in-out"
          style={{ height: `${chartHeight}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 10,
                right: showLabels ? 60 : 10,
                left: 0,
                bottom: 10,
              }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#888888"
                opacity={0.2}
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(value) => formatBytes(value, 0)}
                tick={{ fill: "#888888", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={domainAxisWidth}
                tick={({ x, y, payload }) => (
                  <foreignObject
                    x={Number(x) - domainAxisWidth + 8}
                    y={Number(y) - rowHeight / 2}
                    width={domainLabelWidth}
                    height={rowHeight}>
                    <div className="flex h-full items-center justify-end text-right font-mono text-[11px] leading-4 text-foreground">
                      <span className="min-w-0 break-all" title={String(payload.value)}>{payload.value}</span>
                    </div>
                  </foreignObject>
                )}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip
                content={renderTooltip}
                cursor={{ fill: "rgba(128, 128, 128, 0.1)" }}
              />
              <Bar
                dataKey="download"
                stackId="traffic"
                radius={[0, 0, 0, 0]}
                maxBarSize={config.barSize}
                isAnimationActive={!hasRendered}
                animationDuration={600}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`download-cell-${entry.fullDomain}-${index}`}
                    fill={withAlpha(entry.baseColor, 0.75)}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="upload"
                stackId="traffic"
                radius={[0, 4, 4, 0]}
                maxBarSize={config.barSize}
                isAnimationActive={!hasRendered}
                animationDuration={600}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`upload-cell-${entry.fullDomain}-${index}`}
                    fill={entry.baseColor}
                  />
                ))}
                {showLabels && (
                  <LabelList
                    dataKey="total"
                    position="right"
                    content={renderCustomBarLabel}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
