"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Laptop, Loader2, Minus, Search, X } from "lucide-react";
import type { ComparisonRange, DeviceDomainComparisonOptions } from "@neko-master/shared";
import { api } from "@/lib/api";
import { getDeviceDomainComparisonQueryKey } from "@/lib/stats-query-keys";
import { getTrafficChange } from "@/lib/comparison";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Favicon } from "@/components/common";

export interface DeviceComparisonSelection {
  backendId: number;
  sourceIP: string;
  name: string;
  current: ComparisonRange;
  baseline: ComparisonRange;
}

function TrafficChange({ current, baseline }: { current: number; baseline: number }) {
  const t = useTranslations("deviceComparison");
  const { delta, percent } = getTrafficChange(current, baseline);
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  return <span className={cn("inline-flex flex-wrap justify-end gap-x-1.5 gap-y-0.5 text-xs tabular-nums", delta > 0 ? "text-amber-700 dark:text-amber-400" : delta < 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap"><Icon className="h-3 w-3" />{delta > 0 ? "+" : delta < 0 ? "−" : ""}{formatBytes(Math.abs(delta))}</span><span className="whitespace-nowrap">{percent === null ? t("new") : `${Math.abs(percent).toFixed(1)}%`}</span>
  </span>;
}

export function DeviceDomainComparisonDialog({ selection, onClose }: { selection: DeviceComparisonSelection; onClose: () => void }) {
  const t = useTranslations("deviceComparison");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<DeviceDomainComparisonOptions["filter"]>("all");
  const [offset, setOffset] = useState(0);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const options: DeviceDomainComparisonOptions = { offset, limit: 20, search: debouncedSearch, filter };
  const { backendId, sourceIP, current, baseline } = selection;
  const query = useQuery({
    queryKey: getDeviceDomainComparisonQueryKey(backendId, sourceIP, current, baseline, options),
    queryFn: () => api.getDeviceDomainComparison(backendId, sourceIP, current, baseline, options),
    staleTime: 30_000,
  });
  const data = query.data;
  const dateTime = (value: string) => new Date(value).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-5xl">
      <DialogHeader className="pr-7 text-left">
        <DialogTitle>{t("title")}</DialogTitle>
        <div className="flex items-start gap-2 text-sm"><Laptop className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-all font-medium">{data?.device.displayName || selection.name}{(data?.device.displayName || selection.name !== sourceIP) && <span className="ml-2 text-xs font-normal text-muted-foreground">{sourceIP}</span>}</span></div>
        <DialogDescription className="text-xs leading-relaxed">{t("description")}</DialogDescription>
      </DialogHeader>
      <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8" aria-label={t("close")}><X className="h-4 w-4" /></Button></DialogClose>
      <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-2"><p>{t("current")}: {dateTime(current.start)} ~ {dateTime(current.end)}</p><p>{t("baseline")}: {dateTime(baseline.start)} ~ {dateTime(baseline.end)}</p></div>
      {data && <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">{t("currentTotal")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatBytes(data.currentBytes)}</p></div>
        <div><p className="text-xs text-muted-foreground">{t("baselineTotal")}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatBytes(data.baselineBytes)}</p></div>
        <div className="col-span-2 sm:col-span-1"><p className="mb-2 text-xs text-muted-foreground">{t("change")}</p><TrafficChange current={data.currentBytes} baseline={data.baselineBytes} /></div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs className="max-w-full" value={filter} onValueChange={value => { setFilter(value as typeof filter); setOffset(0); }}><TabsList className="h-auto flex-wrap">{(["all", "increased", "decreased", "new"] as const).map(value => <TabsTrigger key={value} value={value} className="px-3 py-2 text-xs">{t(value)}</TabsTrigger>)}</TabsList></Tabs>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} maxLength={253} onChange={event => { setSearch(event.target.value); setOffset(0); }} placeholder={t("search")} aria-label={t("search")} className="pl-9" /></div>
      </div>
      {query.isError ? <div role="alert" className="space-y-3 rounded-xl border border-border p-6"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : !data || search.trim() !== debouncedSearch ? <div className="space-y-3" aria-busy="true" aria-label={t("loading")}>{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
        : !data.rows.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{search || filter !== "all" ? t("noMatches") : t("empty")}</div>
        : <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_8rem] gap-3 bg-muted/40 px-4 py-3 text-right text-xs text-muted-foreground md:grid"><span className="text-left">{t("domain")}</span><span>{t("current")}</span><span>{t("baseline")}</span><span>{t("change")}</span></div>
          <div className="max-h-[45dvh] divide-y divide-border overflow-y-auto">{data.rows.map(row => <div key={row.key} className="grid grid-cols-3 items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_6rem_6rem_8rem]">
            <div className="col-span-3 flex min-w-0 items-center gap-2 md:col-span-1"><Favicon domain={row.key} size="sm" className="shrink-0" /><p className="min-w-0 break-all text-sm font-medium">{row.key}</p></div>
            <div className="text-sm tabular-nums md:text-right"><p className="mb-1 text-[10px] text-muted-foreground md:hidden">{t("current")}</p>{formatBytes(row.currentBytes)}</div>
            <div className="text-sm tabular-nums text-muted-foreground md:text-right"><p className="mb-1 text-[10px] md:hidden">{t("baseline")}</p>{formatBytes(row.baselineBytes)}</div>
            <div className="text-right"><p className="mb-1 text-[10px] text-muted-foreground md:hidden">{t("change")}</p><TrafficChange current={row.currentBytes} baseline={row.baselineBytes} /></div>
          </div>)}</div>
        </div>}
      {data && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{t("results", { count: data.total })}{query.isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - options.limit))}><ChevronLeft className="mr-1 h-3 w-3" />{t("previous")}</Button><span className="tabular-nums">{Math.floor(offset / options.limit) + 1} / {Math.max(1, Math.ceil(data.total / options.limit))}</span><Button size="sm" variant="outline" disabled={offset + options.limit >= data.total || query.isFetching} onClick={() => setOffset(offset + options.limit)}>{t("next")}<ChevronRight className="ml-1 h-3 w-3" /></Button></div></div>}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("totalsHint")}</p>
    </DialogContent>
  </Dialog>;
}
