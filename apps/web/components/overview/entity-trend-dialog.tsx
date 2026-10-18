"use client";

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

export interface TrendEntity { dimension: TrafficEntityDimension; value: string }

export function EntityTrendDialog({ entity, backendId, range, onClose }: {
  entity: TrendEntity; backendId: number; range: TimeRange; onClose: () => void;
}) {
  const t = useTranslations("entityTrend");
  const locale = useLocale();
  const countryName = useCountryName();
  const { chartColors } = useThemePalette();
  const query = useQuery({
    queryKey: getEntityDailyTrendQueryKey(backendId, entity.dimension, entity.value, range),
    queryFn: () => api.getEntityDailyTrend(backendId, entity.dimension, entity.value, range),
    staleTime: 60_000,
  });
  const points = query.data?.points.map(point => ({ ...point, total: point.upload + point.download })) ?? [];
  const dateTime = (time: string) => new Date(time).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const day = (time: string) => new Date(time).toLocaleDateString(locale, { month: "2-digit", day: "2-digit" });
  const total = points.reduce((sum, point) => sum + point.total, 0);
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
      {query.isError ? <div role="alert" className="space-y-3 rounded-lg border border-border p-5"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("retry")}</Button></div>
        : !query.data ? <div className="h-72 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label={t("loading")} />
        : <>
          <div className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">{t("total")}: {formatBytes(total)}</span><span className="text-muted-foreground">{t("points", { count: points.length })}</span></div>
          {total === 0 && <p role="status" className="text-sm text-muted-foreground">{t("empty")}</p>}
          <div className="h-72 w-full min-w-0 sm:h-80" role="img" aria-label={t("chartLabel", { count: points.length })}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 15, right: 15, bottom: 5, left: 5 }} accessibilityLayer>
                <CartesianGrid stroke="currentColor" opacity={0.12} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="start" tickFormatter={day} minTickGap={25} tick={{ fill: "currentColor", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={value => formatBytes(Number(value), 0)} width={65} tick={{ fill: "currentColor", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as (EntityDailyTrend["points"][number] & { total: number }) | undefined;
                  return active && point ? <div className="max-w-[calc(100vw-3rem)] space-y-1 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"><p>{dateTime(point.start)} ~ {dateTime(point.end)}</p><p>{t("total")}: {formatBytes(point.total)}</p><p>{t("download")}: {formatBytes(point.download)}</p><p>{t("upload")}: {formatBytes(point.upload)}</p></div> : null;
                }} />
                <Line name={t("total")} dataKey="total" type="linear" stroke={chartColors[0]} strokeWidth={2} dot={{ r: 3, fill: chartColors[0] }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">{t("table")}</summary><div className="mt-3 max-h-52 overflow-auto"><table className="w-full text-left tabular-nums"><thead><tr><th className="p-2">{t("period")}</th><th className="p-2">{t("download")}</th><th className="p-2">{t("upload")}</th><th className="p-2">{t("total")}</th></tr></thead><tbody>{points.map(point => <tr key={point.start} className="border-t border-border"><td className="p-2">{dateTime(point.start)} ~ {dateTime(point.end)}</td><td className="p-2">{formatBytes(point.download)}</td><td className="p-2">{formatBytes(point.upload)}</td><td className="p-2">{formatBytes(point.total)}</td></tr>)}</tbody></table></div></details>
        </>}
    </DialogContent>
  </Dialog>;
}
