"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Link2, Monitor, Server } from "lucide-react";
import { api, type TimeRange } from "@/lib/api";
import { getDomainUsageQueryKey } from "@/lib/stats-query-keys";
import { groupDomainUsage, usageValue, type UsageItem, type UsageMetric } from "@/lib/domain-usage";
import { cn, formatBytes, formatNumber } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Favicon } from "@/components/common";

export function DomainUsageDialog({ domain, backendId, range, onClose, onTrend }: {
  domain: string; backendId: number; range: TimeRange; onClose: () => void; onTrend?: () => void;
}) {
  const t = useTranslations("domainUsage");
  const locale = useLocale();
  const [metric, setMetric] = useState<UsageMetric>("traffic");
  // undefined selects all devices; null selects the aggregated overflow group.
  const [device, setDevice] = useState<string | null | undefined>(undefined);
  const query = useQuery({
    queryKey: getDomainUsageQueryKey(backendId, domain, range),
    queryFn: () => api.getDomainUsage(backendId, domain, range),
    staleTime: 30_000,
  });
  const rows = query.data ?? [];
  const scoped = device === undefined ? rows : rows.filter(row => row.sourceIP === device);
  const devices = groupDomainUsage(rows, "device", metric);
  const proxies = groupDomainUsage(scoped, "proxy", metric);
  const totals = rows.reduce((sum, row) => ({ totalUpload: sum.totalUpload + row.totalUpload,
    totalDownload: sum.totalDownload + row.totalDownload, totalConnections: sum.totalConnections + row.totalConnections }),
  { totalUpload: 0, totalDownload: 0, totalConnections: 0 });
  const totalValue = usageValue(totals, metric);
  const scopedValue = scoped.reduce((sum, row) => sum + usageValue(row, metric), 0);
  const deviceName = (item: UsageItem) => item.key === null ? t("otherDevices") : item.displayName || item.key || t("unknownDevice");
  const selectedName = devices.find(item => item.key === device);
  const dateTime = (value: string) => new Date(value).toLocaleString(locale);

  const renderItem = (item: UsageItem, dimension: "device" | "proxy", denominator: number) => {
    const percent = denominator > 0 ? usageValue(item, metric) / denominator * 100 : 0;
    const name = dimension === "device" ? deviceName(item) : item.key === null ? t("otherProxies") : item.key || t("unknownProxy");
    const content = <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all text-sm font-medium">{name}</p>
          {dimension === "device" && item.displayName && <p className="break-all text-xs text-muted-foreground">{item.key}</p>}
          {dimension === "proxy" && item.chains.map(chain => <p key={chain} className="break-all text-xs text-muted-foreground">{chain}</p>)}
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <p className="text-sm font-semibold">{metric === "traffic" ? formatBytes(usageValue(item, metric)) : formatNumber(item.totalConnections)}</p>
          <p className="text-xs font-medium text-primary">{percent.toFixed(1)}%</p>
        </div>
      </div>
      <div className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
        <span className="flex items-center gap-1"><ArrowDown className="size-3 text-blue-500 dark:text-blue-400" />{formatBytes(item.totalDownload)}</span>
        <span className="flex items-center gap-1"><ArrowUp className="size-3 text-purple-500 dark:text-purple-400" />{formatBytes(item.totalUpload)}</span>
        <span className="flex items-center gap-1"><Link2 className="size-3" />{t("connectionCount", { count: formatNumber(item.totalConnections) })}</span>
      </div>
    </>;
    const className = cn("w-full min-w-0 rounded-xl border border-border bg-card/50 p-3 text-left", dimension === "device" && "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", dimension === "device" && device === item.key && "border-primary bg-accent");
    return <li key={JSON.stringify(item.key)} className="min-w-0">{dimension === "device"
      ? <button type="button" className={className} aria-pressed={device === item.key} onClick={() => setDevice(device === item.key ? undefined : item.key)}>{content}</button>
      : <div className={className}>{content}</div>}</li>;
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium"><Favicon domain={domain} size="sm" className="shrink-0" /><span className="break-all">{domain}</span></div>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">{dateTime(range.start)} ~ {dateTime(range.end)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t("metric")} className="flex gap-1 rounded-lg border border-border p-1">
          {(["traffic", "connections"] as const).map(value => <Button key={value} size="sm" variant={metric === value ? "secondary" : "ghost"} aria-pressed={metric === value} onClick={() => setMetric(value)}>{t(value)}</Button>)}
        </div>
        {onTrend && <Button size="sm" variant="outline" onClick={onTrend}>{t("trend")}</Button>}
      </div>
      {query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-border p-5"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : !query.data ? <div aria-busy="true" aria-label={t("loading")} className="h-64 animate-pulse rounded-xl bg-muted" />
        : !rows.length ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
        : <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[[t("traffic"), formatBytes(totals.totalUpload + totals.totalDownload)], [t("download"), formatBytes(totals.totalDownload)], [t("upload"), formatBytes(totals.totalUpload)], [t("connections"), formatNumber(totals.totalConnections)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>)}
          </div>
          <div className="grid min-w-0 gap-5 md:grid-cols-2">
            <section className="min-w-0 space-y-3" aria-label={t("devices")}>
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Monitor className="size-4" />{t("devices")}</h3><Button size="sm" variant="ghost" onClick={() => setDevice(undefined)} aria-pressed={device === undefined}>{t("allDevices")}</Button></div>
              <p className="text-xs text-muted-foreground">{t("deviceHint")}</p>
              <ul className="max-h-96 space-y-2 overflow-y-auto p-1">{devices.map(item => renderItem(item, "device", totalValue))}</ul>
            </section>
            <section className="min-w-0 space-y-3" aria-label={t("proxies")}>
              <h3 className="flex min-h-8 items-center gap-2 text-sm font-semibold"><Server className="size-4" />{t("proxies")}</h3>
              <p className="break-all text-xs text-muted-foreground" aria-live="polite">{selectedName ? t("selectedDevice", { device: deviceName(selectedName) }) : t("proxyHint")}</p>
              <ul className="max-h-96 space-y-2 overflow-y-auto p-1">{proxies.map(item => renderItem(item, "proxy", scopedValue))}</ul>
            </section>
          </div>
          {rows.some(row => row.sourceIP === null) && <p className="text-xs text-muted-foreground">{t("overflowHint")}</p>}
        </>}
      <p className="text-xs leading-relaxed text-muted-foreground">{t("savedHint")}</p>
    </DialogContent>
  </Dialog>;
}
