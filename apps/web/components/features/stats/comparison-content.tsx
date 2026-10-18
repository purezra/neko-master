"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, GitCompareArrows, Minus, RefreshCw } from "lucide-react";
import type { TrafficComparisonRow } from "@neko-master/shared";
import { api, type TimeRange } from "@/lib/api";
import { getComparisonQueryKey } from "@/lib/stats-query-keys";
import { getComparisonWindows, getTrafficChange, type ComparisonPreset } from "@/lib/comparison";
import { formatBytes, formatNumber, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Favicon } from "@/components/common";

export function ComparisonContent({ activeBackendId, timeRange, autoRefresh }: { activeBackendId?: number; timeRange: TimeRange; autoRefresh: boolean }) {
  const t = useTranslations("comparison");
  const locale = useLocale();
  const [preset, setPreset] = useState<ComparisonPreset>("today");
  const windows = getComparisonWindows(preset, timeRange);
  const query = useQuery({
    queryKey: getComparisonQueryKey(activeBackendId, windows?.current, windows?.baseline),
    queryFn: () => api.getTrafficComparison(activeBackendId!, windows!.current, windows!.baseline),
    enabled: !!activeBackendId && !!windows,
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
  });
  const dateTime = (value: string) => new Date(value).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const renderChange = (current: number, baseline: number, bytes = true) => {
    const { delta, percent } = getTrafficChange(current, baseline);
    const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
    return <span className={cn("inline-flex items-center gap-1 text-xs tabular-nums", delta > 0 ? "text-amber-700 dark:text-amber-400" : delta < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
      <Icon className="h-3 w-3" />{delta > 0 ? "+" : delta < 0 ? "−" : ""}{bytes ? formatBytes(Math.abs(delta)) : formatNumber(Math.abs(delta))}
      <span>({percent === null ? t("new") : `${Math.abs(percent).toFixed(1)}%`})</span>
    </span>;
  };
  const ranking = (title: string, rows: TrafficComparisonRow[], showDomainIcons = false) => <Card className="min-w-0">
    <CardHeader><CardTitle className="text-base">{title}</CardTitle><p className="text-xs text-muted-foreground">{t("rankingHint")}</p></CardHeader>
    <CardContent className="space-y-4">
      {!rows.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("noGrowth")}</div>}
      {rows.map((row, index) => <div key={row.key} className="space-y-2">
        <div className="flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0"><div className="flex items-center gap-2">
            <span className="shrink-0 font-medium">{index + 1}.</span>
            {showDomainIcons && <Favicon domain={row.key} size="sm" className="shrink-0" />}
            <p className="min-w-0 break-all font-medium" title={row.key}>{row.displayName || row.key}</p>
          </div>
            {(row.displayName || row.groupName) && <p className="truncate text-xs text-muted-foreground">{row.key}{row.groupName ? ` · ${row.groupName}` : ""}</p>}
          </div>
          <div className="shrink-0 text-right"><p className="font-medium tabular-nums">{formatBytes(row.currentBytes)}</p>{renderChange(row.currentBytes, row.baselineBytes)}</div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span>{t("baseline")}: {formatBytes(row.baselineBytes)}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80" style={{ width: `${rows[0].currentBytes ? row.currentBytes / Math.max(...rows.map(item => item.currentBytes)) * 100 : 0}%` }} /></div>
      </div>)}
    </CardContent>
  </Card>;
  const data = query.data;
  const metrics = data ? [
    { key: "traffic", current: data.current.totalUpload + data.current.totalDownload, baseline: data.baseline.totalUpload + data.baseline.totalDownload, bytes: true },
    { key: "download", current: data.current.totalDownload, baseline: data.baseline.totalDownload, bytes: true },
    { key: "upload", current: data.current.totalUpload, baseline: data.baseline.totalUpload, bytes: true },
    { key: "connections", current: data.current.totalConnections, baseline: data.baseline.totalConnections, bytes: false },
    { key: "domains", current: data.current.uniqueDomains, baseline: data.baseline.uniqueDomains, bytes: false },
  ] : [];
  return <div className="space-y-6">
    <Card><CardContent className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><GitCompareArrows className="h-5 w-5 text-primary" />{t("title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("description")}</p></div>
        <Tabs className="max-w-full" value={preset} onValueChange={value => setPreset(value as ComparisonPreset)}><TabsList className="h-auto flex-wrap">{(["today", "week", "selected"] as const).map(value => <TabsTrigger key={value} value={value} className="whitespace-normal text-xs sm:text-sm">{t(value)}</TabsTrigger>)}</TabsList></Tabs>
      </div>
      {windows && <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>{t("current")}: {dateTime(windows.current.start)} ~ {dateTime(windows.current.end)}</p><p>{t("baseline")}: {dateTime(windows.baseline.start)} ~ {dateTime(windows.baseline.end)}</p></div>}
      <p className="text-xs text-muted-foreground">{t("rangeHint")}</p>
    </CardContent></Card>
    {!activeBackendId || !windows ? <Card><CardContent className="p-8 text-center text-muted-foreground">{t("noRange")}</CardContent></Card>
      : query.isError ? <Card><CardContent className="flex items-center justify-between gap-3 p-5" role="alert"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{t("retry")}</Button></CardContent></Card>
      : !data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-muted" />)}</div>
      : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(metric => <Card key={metric.key}><CardContent className="space-y-2 p-4"><p className="text-xs text-muted-foreground">{t(metric.key)}</p><p className="text-xl font-semibold tabular-nums">{metric.bytes ? formatBytes(metric.current) : formatNumber(metric.current)}</p><p className="text-xs text-muted-foreground">{t("baseline")}: {metric.bytes ? formatBytes(metric.baseline) : formatNumber(metric.baseline)}</p>{renderChange(metric.current, metric.baseline, metric.bytes)}</CardContent></Card>)}</div>
        <div className="grid items-start gap-6 lg:grid-cols-2">{ranking(t("deviceGrowth"), data.devices)}{ranking(t("domainGrowth"), data.domains, true)}</div>
      </>}
  </div>;
}
