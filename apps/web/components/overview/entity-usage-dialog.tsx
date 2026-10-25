"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Monitor } from "lucide-react";
import type { EntityUsageRow } from "@neko-master/shared";
import { api, type TimeRange } from "@/lib/api";
import { getEntityUsageQueryKey } from "@/lib/stats-query-keys";
import { usageValue, type UsageMetric } from "@/lib/domain-usage";
import { formatBytes, formatNumber } from "@/lib/utils";
import { useCountryName } from "@/lib/i18n-country";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Favicon } from "@/components/common";
import { CountryFlag } from "@/components/features/countries";

export function EntityUsageDialog({ dimension, value, backendId, range, onClose, onTrend }: {
  dimension: "proxy" | "country"; value: string; backendId: number; range: TimeRange; onClose: () => void; onTrend?: () => void;
}) {
  const t = useTranslations("domainUsage");
  const locale = useLocale();
  const countryName = useCountryName();
  const [metric, setMetric] = useState<UsageMetric>("traffic");
  const query = useQuery({ queryKey: getEntityUsageQueryKey(backendId, dimension, value, range, metric),
    queryFn: () => api.getEntityUsage(backendId, dimension, value, range, metric), staleTime: 30_000 });
  const rows = query.data ?? [];
  const totals = rows.find(row => row.kind === "total");
  const denominator = totals ? usageValue(totals, metric) : 0;
  const dateTime = (time: string) => new Date(time).toLocaleString(locale);
  const renderList = (kind: "device" | "domain") => {
    const items = rows.filter(row => row.kind === kind).sort((a, b) => usageValue(b, metric) - usageValue(a, metric));
    const name = (row: EntityUsageRow) => kind === "device" ? row.displayName || row.key || t("unknownDevice") : row.key || t("unknownDomain");
    return <section className="min-w-0 space-y-3" aria-label={t(kind === "device" ? "topDevices" : "topDomains")}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">{kind === "device" ? <Monitor className="size-4" /> : <Globe className="size-4" />}{t(kind === "device" ? "topDevices" : "topDomains")}</h3>
      <ol className="space-y-2">{items.map((row, index) => {
        const percent = denominator > 0 ? usageValue(row, metric) / denominator * 100 : 0;
        return <li key={row.key} className="min-w-0 rounded-xl border border-border bg-card/50 p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2"><span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>{kind === "domain" && row.key && <Favicon domain={row.key} size="sm" className="shrink-0" />}<div className="min-w-0"><p className="break-all text-sm font-medium">{name(row)}</p>{kind === "device" && row.displayName && <p className="break-all text-xs text-muted-foreground">{row.key}</p>}</div></div>
            <div className="shrink-0 text-right tabular-nums"><p className="text-sm font-semibold">{metric === "traffic" ? formatBytes(usageValue(row, metric)) : formatNumber(row.totalConnections)}</p><p className="text-xs font-medium text-primary">{percent.toFixed(1)}%</p></div>
          </div>
          <div className="my-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground"><span>{t("download")} {formatBytes(row.totalDownload)}</span><span>{t("upload")} {formatBytes(row.totalUpload)}</span><span>{t("connectionCount", { count: formatNumber(row.totalConnections) })}</span></div>
        </li>;
      })}</ol>
    </section>;
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t(dimension === "proxy" ? "proxyTitle" : "countryTitle")}</DialogTitle>
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">{dimension === "country" && <CountryFlag country={value} className="h-3.5 w-5 shrink-0" />}<span className="break-all">{dimension === "country" ? countryName(value) : value}</span></div>
        <DialogDescription>{t("topDescription")}</DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">{dateTime(range.start)} ~ {dateTime(range.end)}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={t("metric")} className="flex gap-1 rounded-lg border border-border p-1">{(["traffic", "connections"] as const).map(item => <Button key={item} size="sm" variant={metric === item ? "secondary" : "ghost"} aria-pressed={metric === item} onClick={() => setMetric(item)}>{t(item)}</Button>)}</div>
        {onTrend && <Button size="sm" variant="outline" onClick={onTrend}>{t("trend")}</Button>}
      </div>
      {query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-border p-5"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : !query.data ? <div aria-busy="true" aria-label={t("loading")} className="h-64 animate-pulse rounded-xl bg-muted" />
        : !rows.some(row => row.kind !== "total") ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">{t("relatedEmpty")}</p>
        : <>
          {totals && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[t("traffic"), formatBytes(totals.totalUpload + totals.totalDownload)], [t("download"), formatBytes(totals.totalDownload)], [t("upload"), formatBytes(totals.totalUpload)], [t("connections"), formatNumber(totals.totalConnections)]].map(([label, count]) => <div key={label} className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{count}</p></div>)}</div>}
          <p className="text-xs text-muted-foreground">{t("topHint")}</p>
          <div className="grid min-w-0 gap-5 md:grid-cols-2">{renderList("device")}{renderList("domain")}</div>
        </>}
      {dimension === "country" && <p className="text-xs leading-relaxed text-muted-foreground">{t("countryHint")}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{t("savedHint")}</p>
    </DialogContent>
  </Dialog>;
}
