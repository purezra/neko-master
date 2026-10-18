"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowDownToLine, ArrowUpFromLine, GitCompareArrows, Globe2, Laptop, Link2, Minus, RefreshCw } from "lucide-react";
import type { TrafficComparisonRow } from "@neko-master/shared";
import { api, type TimeRange } from "@/lib/api";
import { getComparisonQueryKey } from "@/lib/stats-query-keys";
import { getComparisonWindows, getTrafficChange, type ComparisonPreset } from "@/lib/comparison";
import { formatBytes, formatNumber, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Favicon } from "@/components/common";

function growthWidth(row: TrafficComparisonRow, rows: TrafficComparisonRow[]): string {
  const max = Math.max(1, ...rows.map(item => item.currentBytes - item.baselineBytes));
  return `${Math.max(0, row.currentBytes - row.baselineBytes) / max * 100}%`;
}

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
  const data = query.data;
  const dateTime = (value: string) => new Date(value).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const renderChange = (current: number, baseline: number, bytes = true) => {
    const { delta, percent } = getTrafficChange(current, baseline);
    const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
    return <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums", delta > 0 ? "text-amber-700 dark:text-amber-400" : delta < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Icon className="h-3 w-3" />{delta > 0 ? "+" : delta < 0 ? "−" : ""}{bytes ? formatBytes(Math.abs(delta)) : formatNumber(Math.abs(delta))}</span>
      <span className="whitespace-nowrap">{percent === null ? t("new") : `${Math.abs(percent).toFixed(1)}%`}</span>
    </span>;
  };
  const emptyGrowth = <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{t("noGrowth")}</div>;
  const totalCurrent = data ? data.current.totalUpload + data.current.totalDownload : 0;
  const totalBaseline = data ? data.baseline.totalUpload + data.baseline.totalDownload : 0;
  const metrics = data ? [
    { key: "download", icon: ArrowDownToLine, current: data.current.totalDownload, baseline: data.baseline.totalDownload, bytes: true },
    { key: "upload", icon: ArrowUpFromLine, current: data.current.totalUpload, baseline: data.baseline.totalUpload, bytes: true },
    { key: "connections", icon: Link2, current: data.current.totalConnections, baseline: data.baseline.totalConnections, bytes: false },
    { key: "domains", icon: Globe2, current: data.current.uniqueDomains, baseline: data.baseline.uniqueDomains, bytes: false },
  ] : [];

  return <div className="space-y-7">
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><GitCompareArrows className="h-5 w-5" /></span>
          <div><h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("description")}</p></div>
        </div>
        <Tabs className="max-w-full" value={preset} onValueChange={value => setPreset(value as ComparisonPreset)}>
          <TabsList className="h-auto flex-wrap gap-1">{(["today", "week", "selected"] as const).map(value => <TabsTrigger key={value} value={value} className="whitespace-normal px-3 py-2 text-xs sm:text-sm">{t(value)}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>
      {windows && <div className="grid gap-3 sm:grid-cols-2">
        {[{ label: t("current"), range: windows.current, active: true }, { label: t("baseline"), range: windows.baseline, active: false }].map(item => <div key={item.label} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-card px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-2 font-medium"><span className={cn("h-1.5 w-1.5 rounded-full", item.active ? "bg-primary" : "bg-muted-foreground/50")} />{item.label}</span>
          <span className="tabular-nums text-muted-foreground">{dateTime(item.range.start)} ~ {dateTime(item.range.end)}</span>
        </div>)}
      </div>}
      <p className="text-xs leading-relaxed text-muted-foreground">{t("rangeHint")}</p>
    </section>

    {!activeBackendId || !windows ? <Card><CardContent className="p-8 text-center text-muted-foreground">{t("noRange")}</CardContent></Card>
      : query.isError ? <Card><CardContent className="flex items-center justify-between gap-3 p-5" role="alert"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{t("retry")}</Button></CardContent></Card>
      : !data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-muted" />)}</div>
      : <>
        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]" aria-label={t("summary")}>
          <Card className="justify-center gap-0 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card py-0 shadow-xs">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <p className="text-sm font-medium text-muted-foreground">{t("traffic")}</p>
              <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-[2.5rem]">{formatBytes(totalCurrent)}</p>
              <div className="space-y-2"><div>{renderChange(totalCurrent, totalBaseline)}</div><p className="text-xs text-muted-foreground">{t("baseline")}: <span className="tabular-nums">{formatBytes(totalBaseline)}</span></p></div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {metrics.map(metric => <Card key={metric.key} className="gap-0 py-0 shadow-xs"><CardContent className="space-y-2.5 p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><metric.icon className="h-3.5 w-3.5 shrink-0" />{t(metric.key)}</p>
              <p className="text-xl font-semibold tracking-tight tabular-nums">{metric.bytes ? formatBytes(metric.current) : formatNumber(metric.current)}</p>
              <div className="space-y-1"><div>{renderChange(metric.current, metric.baseline, metric.bytes)}</div><p className="text-[11px] text-muted-foreground">{t("baseline")}: {metric.bytes ? formatBytes(metric.baseline) : formatNumber(metric.baseline)}</p></div>
            </CardContent></Card>)}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="comparison-devices-title">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="comparison-devices-title" className="flex items-center gap-2 text-base font-semibold"><Laptop className="h-4 w-4 text-muted-foreground" />{t("deviceGrowth")}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{t("deviceCount", { count: data.devices.length })}</span></div>
          <p className="text-xs text-muted-foreground">{t("rankingHint")}</p>
          {!data.devices.length ? emptyGrowth : <div className="flex flex-wrap gap-3">
            {data.devices.map((row, index) => <Card key={row.key} className={cn("min-w-0 flex-[1_1_17rem] gap-0 py-0 shadow-xs", index === 0 && "border-primary/25")}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-2.5"><span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums", index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium leading-5">{row.displayName || row.key}</p>{row.displayName && <p className="mt-0.5 text-xs text-muted-foreground">{row.key}</p>}</div>
                  {row.groupName && <span className="max-w-[35%] break-all rounded-md bg-muted px-2 py-1 text-[10px] leading-tight text-muted-foreground">{row.groupName}</span>}
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] text-muted-foreground">{t("current")}</p><p className="mt-0.5 text-xl font-semibold tabular-nums">{formatBytes(row.currentBytes)}</p></div>{renderChange(row.currentBytes, row.baselineBytes)}</div>
                <div className="space-y-2"><div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: growthWidth(row, data.devices) }} /></div><p className="text-[11px] text-muted-foreground">{t("baseline")}: <span className="tabular-nums">{formatBytes(row.baselineBytes)}</span></p></div>
              </CardContent>
            </Card>)}
          </div>}
        </section>

        <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
          <div className="space-y-2 border-b border-border px-4 py-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-base font-semibold"><Globe2 className="h-4 w-4 text-muted-foreground" />{t("domainGrowth")}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{t("domainCount", { count: data.domains.length })}</span></div><p className="text-xs text-muted-foreground">{t("rankingHint")}</p></div>
          {!data.domains.length ? <div className="p-4 sm:p-6">{emptyGrowth}</div> : <>
            <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_9rem] gap-4 bg-muted/30 px-6 py-3 text-right text-xs text-muted-foreground lg:grid"><span className="text-left">{t("domainLabel")}</span><span>{t("current")}</span><span>{t("baseline")}</span><span>{t("increase")}</span></div>
            <div className="divide-y divide-border/70">
              {data.domains.map((row, index) => <div key={row.key} className="grid grid-cols-3 items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-6 lg:grid-cols-[minmax(0,1fr)_6rem_6rem_9rem]">
                <div className="col-span-3 flex min-w-0 items-center gap-3 lg:col-span-1"><span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span><Favicon domain={row.key} size="sm" className="shrink-0" /><div className="min-w-0 flex-1 space-y-2"><p className="break-all text-sm font-medium leading-5">{row.key}</p><div className="h-1 max-w-72 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/60" style={{ width: growthWidth(row, data.domains) }} /></div></div></div>
                <div className="min-w-0 text-left lg:text-right"><p className="mb-1 text-[10px] text-muted-foreground lg:hidden">{t("current")}</p><p className="text-sm font-medium tabular-nums">{formatBytes(row.currentBytes)}</p></div>
                <div className="min-w-0 text-left lg:text-right"><p className="mb-1 text-[10px] text-muted-foreground lg:hidden">{t("baseline")}</p><p className="text-sm tabular-nums text-muted-foreground">{formatBytes(row.baselineBytes)}</p></div>
                <div className="min-w-0 text-right"><p className="mb-1 text-[10px] text-muted-foreground lg:hidden">{t("increase")}</p>{renderChange(row.currentBytes, row.baselineBytes)}</div>
              </div>)}
            </div>
          </>}
        </Card>
      </>}
  </div>;
}
