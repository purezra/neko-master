"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import type { DeviceTrafficFilters } from "@neko-master/shared";
import { Search, ArrowDownWideNarrow } from "lucide-react";
import { api, type TimeRange } from "@/lib/api";
import { getDeviceTrafficDetailsQueryKey } from "@/lib/stats-query-keys";
import { deviceScopeFilters } from "@/lib/device-traffic";
import { getExportWindow } from "@/lib/export/range";
import { formatBytes, parseApiTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceScopeSelect } from "./device-scope-select";

const PAGE_SIZE = 25;
const INITIAL = { scope: "all", domain: "", rule: "", policyGroup: "", sortBy: "totalTraffic" as const, sortOrder: "desc" as const };
type FilterForm = Omit<DeviceTrafficFilters, "sourceIP" | "groupName" | "ungrouped"> & { scope: string; domain: string; rule: string; policyGroup: string };

export function DeviceTrafficDetails({ backendId, range }: { backendId?: number; range: TimeRange }) {
  // Keep filters during automatic range refreshes; isolate them by backend.
  return <DeviceTrafficDetailsContent key={backendId ?? "none"} backendId={backendId} range={range} />;
}

function DeviceTrafficDetailsContent({ backendId, range }: { backendId?: number; range: TimeRange }) {
  const t = useTranslations("deviceDetails");
  const locale = useLocale();
  const [draft, setDraft] = useState<FilterForm>(INITIAL);
  const [applied, setApplied] = useState<FilterForm>(INITIAL);
  const [pagination, setPagination] = useState({ rangeKey: "", offset: 0 });
  const window = getExportWindow(range);
  const queryRange = window?.queryRange;
  const rangeKey = `${queryRange?.start}:${queryRange?.end}`;
  const offset = pagination.rangeKey === rangeKey ? pagination.offset : 0;
  const setOffset = (value: number | ((current: number) => number)) => setPagination({ rangeKey, offset: typeof value === "function" ? value(offset) : value });
  const { scope, ...fields } = applied;
  const filters: DeviceTrafficFilters = { ...fields, ...deviceScopeFilters(scope) };
  const query = useQuery({
    queryKey: getDeviceTrafficDetailsQueryKey(backendId, queryRange, filters, offset, PAGE_SIZE),
    queryFn: () => api.getDeviceTrafficDetails(backendId!, queryRange!, offset, PAGE_SIZE, filters),
    enabled: !!backendId && !!queryRange, staleTime: 30_000,
  });
  const apply = () => { setApplied(draft); setOffset(0); };
  const rows = query.data?.rows ?? [];
  return <Card className="min-w-0">
    <CardHeader><CardTitle role="heading" aria-level={3} className="flex items-center gap-2 text-base"><Search className="h-4 w-4" />{t("title")}</CardTitle><p className="text-xs leading-relaxed text-muted-foreground">{t("description")}</p>
      {window && <p className="text-xs text-muted-foreground">{t("actualRange", { start: new Date(window.range.start).toLocaleString(), end: new Date(window.range.end).toLocaleString() })}</p>}
    </CardHeader>
    <CardContent className="min-w-0 space-y-4">
      <form className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => { event.preventDefault(); apply(); }}>
        <div className="min-w-0 space-y-2"><Label>{t("scope")}</Label><DeviceScopeSelect backendId={backendId} range={queryRange} value={draft.scope} onChange={scope => setDraft(previous => ({ ...previous, scope }))} /></div>
        {(["domain", "rule", "policyGroup"] as const).map(field => <div key={field} className="min-w-0 space-y-2"><Label htmlFor={`detail-${field}`}>{t(field)}</Label><Input id={`detail-${field}`} value={draft[field]} maxLength={field === "domain" ? 253 : 512} placeholder={t(`${field}Placeholder`)} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} /></div>)}
        <div className="space-y-2"><Label>{t("sort")}</Label><Select value={draft.sortBy} onValueChange={value => setDraft(previous => ({ ...previous, sortBy: value as DeviceTrafficFilters["sortBy"] }))}>
          <SelectTrigger aria-label={t("sort")} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(["totalTraffic", "totalDownload", "totalUpload", "totalConnections", "lastSeen", "device", "domain"] as const).map(value => <SelectItem key={value} value={value}>{t(`sortOptions.${value}`)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>{t("sortOrder")}</Label><Select value={draft.sortOrder} onValueChange={value => setDraft(previous => ({ ...previous, sortOrder: value as "asc" | "desc" }))}>
          <SelectTrigger aria-label={t("sortOrder")} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="desc">{t("descending")}</SelectItem><SelectItem value="asc">{t("ascending")}</SelectItem></SelectContent></Select></div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2"><Button type="submit"><ArrowDownWideNarrow className="mr-2 h-4 w-4" />{t("apply")}</Button><Button type="button" variant="outline" onClick={() => { setDraft(INITIAL); setApplied(INITIAL); setOffset(0); }}>{t("reset")}</Button></div>
      </form>
      {!backendId || !queryRange ? <p className="py-8 text-center text-sm text-muted-foreground">{t("noRange")}</p>
        : query.isError ? <div role="alert" className="space-y-3 rounded-lg border border-border p-4"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : query.isPending ? <div className="h-48 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label={t("loading")} />
        : !rows.length ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        : <Table className="min-w-[1344px] table-fixed text-[11px] leading-5">
          <colgroup>{[120, 160, 152, 128, 120, 224, 80, 80, 88, 64, 128].map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <TableHeader><TableRow>{["device", "domain", "matchedRule", "rule", "policyGroup", "chain", "download", "upload", "total", "connections", "lastSeen"].map((key, index) => <TableHead key={key} className={`whitespace-normal leading-4 ${index >= 6 && index <= 9 ? "text-right" : ""}`}>{t(key)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const lastSeen = parseApiTimestamp(row.lastSeen);
              return <TableRow key={index}>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]"><p className="font-medium">{row.displayName || row.sourceIP || t("unknownDevice")}</p>{row.displayName && <p className="text-muted-foreground">{row.sourceIP}</p>}{row.groupName && <p className="text-muted-foreground">{row.groupName}</p>}</TableCell>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]"><p>{row.domain || t("ipOnly")}</p><p className="text-muted-foreground">{row.ip}</p></TableCell>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]">{row.matchedRule ? <><p>{row.matchedRule}</p><p className="text-muted-foreground">{row.rulePayload}</p></> : <span className="text-muted-foreground">{t("notRecorded")}</span>}</TableCell>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]">{row.rule}</TableCell>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]">{row.chain.includes(" > ") ? row.rule : "—"}</TableCell>
                <TableCell className="whitespace-normal align-top [overflow-wrap:anywhere]">{row.chain}</TableCell>
                {[row.totalDownload, row.totalUpload, row.totalUpload + row.totalDownload].map((bytes, i) => <TableCell key={i} className="whitespace-nowrap text-right align-top tabular-nums">{formatBytes(bytes)}</TableCell>)}
                <TableCell className="whitespace-normal text-right align-top tabular-nums [overflow-wrap:anywhere]">{row.totalConnections}</TableCell>
                <TableCell className="whitespace-normal align-top tabular-nums"><p>{lastSeen.toLocaleDateString(locale)}</p><p className="text-muted-foreground">{lastSeen.toLocaleTimeString(locale)}</p></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground"><span>{t("page", { page: offset / PAGE_SIZE + 1, count: rows.length })}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!offset || query.isFetching} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>{t("previous")}</Button><Button variant="outline" size="sm" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setOffset(value => value + PAGE_SIZE)}>{t("next")}</Button></div></div>
    </CardContent>
  </Card>;
}
