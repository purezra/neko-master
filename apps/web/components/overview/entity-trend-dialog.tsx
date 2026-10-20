"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrafficEntityDimension, EntityDailyTrend } from "@neko-master/shared";
import { api, type TimeRange } from "@/lib/api";
import { getEntityDailyTrendQueryKey } from "@/lib/stats-query-keys";
import { formatBytes } from "@/lib/utils";
import { useThemePalette } from "@/lib/hooks/use-theme-palette";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Favicon } from "@/components/common";
import { CountryFlag } from "@/components/features/countries";
import { useCountryName } from "@/lib/i18n-country";
import { DeviceScopeSelect } from "@/components/features/devices/device-scope-select";
import { trafficValue, type TrafficMetric } from "@/lib/trend-series";

export interface TrendEntity { dimension: TrafficEntityDimension; value: string }

export function EntityTrendDialog({ entity, backendId, range, onClose }: {
  entity: TrendEntity; backendId: number; range: TimeRange; onClose: () => void;
}) {
  const t = useTranslations("entityTrend");
  const locale = useLocale();
  const countryName = useCountryName();
  const { chartColors } = useThemePalette();
  const [smooth, setSmooth] = useState(false);
  const [byDevice, setByDevice] = useState(false);
  const [metric, setMetric] = useState<TrafficMetric>("total");
  const [deviceScope, setDeviceScope] = useState("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const sourceIP = byDevice && deviceScope.startsWith("ip:") ? deviceScope.slice(3) : undefined;
  const query = useQuery({
    queryKey: getEntityDailyTrendQueryKey(backendId, entity.dimension, entity.value, range, byDevice, sourceIP),
    queryFn: () => api.getEntityDailyTrend(backendId, entity.dimension, entity.value, range, byDevice, sourceIP),
    staleTime: 60_000,
  });
  const points = query.data?.points.map(point => ({ ...point, total: point.upload + point.download })) ?? [];
  const series = byDevice ? (query.data?.devices ?? []).map((device, index) => ({
    key: `device${index}`,
    id: JSON.stringify(device.sourceIP),
    name: device.sourceIP === null ? t("otherDevices") : device.sourceIP === "" ? t("unknownDevice")
      : device.displayName ? `${device.displayName} (${device.sourceIP})` : device.sourceIP,
    points: device.points,
    color: chartColors[index % chartColors.length],
  })) : [{ key: "total", id: "total", name: t("total"), points, color: chartColors[0] }];
  const visible = series.filter(item => !byDevice || !hidden.has(item.id));
  const chartPoints = points.map((point, index) => ({ ...point,
    ...Object.fromEntries(visible.map(item => [item.key, item.points[index] ? trafficValue(item.points[index], metric) : 0])),
  }));
  const dateTime = (time: string) => new Date(time).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const day = (time: string) => new Date(time).toLocaleDateString(locale, { month: "2-digit", day: "2-digit" });
  const total = visible.reduce((sum, item) => sum + item.points.reduce((bytes, point) => bytes + trafficValue(point, metric), 0), 0);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {entity.dimension === "domain" && <Favicon domain={entity.value} size="sm" className="shrink-0" />}
          {entity.dimension === "country" && <CountryFlag country={entity.value} className="h-3.5 w-5 shrink-0" />}
          <span className="break-all">{entity.dimension === "country" ? countryName(entity.value) : entity.value}</span>
        </div>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">{dateTime(range.start)} ~ {dateTime(range.end)}</p>
      <div className="flex flex-wrap gap-3">
        <div role="group" aria-label={t("curveStyle")} className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          <Button size="sm" variant={!smooth ? "secondary" : "ghost"} aria-pressed={!smooth} onClick={() => setSmooth(false)}>{t("linear")}</Button>
          <Button size="sm" variant={smooth ? "secondary" : "ghost"} aria-pressed={smooth} onClick={() => setSmooth(true)}>{t("smooth")}</Button>
        </div>
        <div role="group" aria-label={t("seriesMode")} className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          <Button size="sm" variant={!byDevice ? "secondary" : "ghost"} aria-pressed={!byDevice} onClick={() => setByDevice(false)}>{t("total")}</Button>
          <Button size="sm" variant={byDevice ? "secondary" : "ghost"} aria-pressed={byDevice} onClick={() => setByDevice(true)}>{t("byDevice")}</Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <div role="group" aria-label={t("metric")} className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {(["total", "download", "upload"] as const).map(value => <Button key={value} size="sm" variant={metric === value ? "secondary" : "ghost"} aria-pressed={metric === value} onClick={() => setMetric(value)}>{t(value)}</Button>)}
        </div>
        {byDevice && <div className="w-full min-w-0 sm:w-80"><DeviceScopeSelect backendId={backendId} range={range} value={deviceScope} onChange={value => { setDeviceScope(value); setHidden(new Set()); }} devicesOnly /></div>}
      </div>
      {byDevice && <p className="text-xs leading-relaxed text-muted-foreground">{t("deviceHint")}{entity.dimension === "country" && <> {t("countryDeviceHint")}</>}</p>}
      {query.isError ? <div role="alert" className="space-y-3 rounded-lg border border-border p-5"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : !query.data ? <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label={t("loading")} />
        : <>
          <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">{t(metric)}: {formatBytes(total)}</span><span className="text-muted-foreground">{t("points", { count: points.length })}</span></div>
          {(byDevice ? series.length === 0 : total === 0) && <p role="status" className="text-sm text-muted-foreground">{t("empty")}</p>}
          {byDevice && <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-2 overflow-auto text-xs" aria-label={t("legend")}>
            {series.map(item => <button key={item.id} type="button" aria-pressed={!hidden.has(item.id)} aria-label={t("toggleDevice", { device: item.name })} className={`flex min-w-0 items-start gap-1.5 text-left ${hidden.has(item.id) ? "opacity-40 line-through" : ""}`} onClick={() => setHidden(previous => { const next = new Set(previous); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="break-all">{item.name}</span></button>)}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setHidden(new Set())}>{t("showAll")}</button>
          </div>}
          {byDevice && series.length > 0 && !visible.length && <p role="status" className="text-xs text-muted-foreground">{t("noVisible")}</p>}
          <div className="h-72 w-full min-w-0 sm:h-80" role="img" aria-label={t("chartLabel", { count: points.length })}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints} margin={{ top: 15, right: 15, bottom: 5, left: 5 }} accessibilityLayer>
                <CartesianGrid stroke="currentColor" opacity={0.12} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="start" tickFormatter={day} minTickGap={25} tick={{ fill: "currentColor", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => formatBytes(Number(value), 0)} width={65} tick={{ fill: "currentColor", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (EntityDailyTrend["points"][number] & { total: number }) | undefined;
                  const index = points.findIndex(item => item.start === point?.start);
                  return active && point ? <div className="max-h-72 max-w-[calc(100vw-3rem)] space-y-2 overflow-auto rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"><p>{dateTime(point.start)} ~ {dateTime(point.end)}</p>{visible.map(item => {
                    const values = item.points[index];
                    return values && <div key={item.key} className="space-y-1"><p className="flex items-start gap-1.5 font-medium"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="break-all">{item.name}: {formatBytes(trafficValue(values, metric))}</span></p><p>{t("download")}: {formatBytes(values.download)} · {t("upload")}: {formatBytes(values.upload)}</p></div>;
                  })}</div> : null;
                }} />
                {visible.map(item => <Line key={item.key} name={item.name} dataKey={item.key} type={smooth ? "monotone" : "linear"} stroke={item.color} strokeWidth={2} dot={{ r: byDevice ? 2 : 3, fill: item.color }} activeDot={{ r: 5 }} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="min-w-0 text-xs"><summary className="cursor-pointer text-muted-foreground">{t("table")}</summary><div className="mt-3 max-h-52 max-w-full overflow-auto"><table className="w-full text-left tabular-nums"><thead><tr><th className="p-2">{t("period")}</th>{byDevice && <th className="p-2">{t("device")}</th>}<th className="p-2">{t("download")}</th><th className="p-2">{t("upload")}</th><th className="p-2">{t("total")}</th></tr></thead><tbody>{visible.flatMap(item => item.points.map(point => <tr key={`${item.key}-${point.start}`} className="border-t border-border"><td className="whitespace-nowrap p-2">{dateTime(point.start)} ~ {dateTime(point.end)}</td>{byDevice && <td className="min-w-32 break-all p-2">{item.name}</td>}<td className="whitespace-nowrap p-2">{formatBytes(point.download)}</td><td className="whitespace-nowrap p-2">{formatBytes(point.upload)}</td><td className="whitespace-nowrap p-2">{formatBytes(point.upload + point.download)}</td></tr>))}</tbody></table></div></details>
        </>}
    </DialogContent>
  </Dialog>;
}
