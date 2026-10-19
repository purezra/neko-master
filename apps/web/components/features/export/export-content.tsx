"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TimeRangePicker } from "@/components/common";
import { cn } from "@/lib/utils";
import type { TimeRange } from "@/lib/api";
import type { BackendStatus, TimePreset } from "@/lib/types/dashboard";
import {
  buildExportDatasets,
  EXPORT_DATASET_IDS,
  EXPORT_TOP_N_OPTIONS,
  type ExportDatasetId,
  type ExportTopN,
} from "@/lib/export/dataset";
import {
  downloadBlob,
  getExportFileName,
  formatExportDateTime,
  type ExportFileMeta,
  type ExportFormat,
} from "@/lib/export/file";
import { buildExportJson } from "@/lib/export/json";
import { buildExportCsv } from "@/lib/export/csv";
import { buildExportXlsxBlob } from "@/lib/export/xlsx";
import { useExportHistory } from "@/lib/export/history";
import { getExportContinuationRange, getExportWindow } from "@/lib/export/range";
import { useExportSources } from "./use-export-sources";

const ALL_DATASETS: Record<ExportDatasetId, true> = {
  summary: true,
  domains: true,
  ips: true,
  rules: true,
  countries: true,
  proxies: true,
  devices: true,
};

const ALL_DATASETS_SELECTED: Record<ExportDatasetId, boolean> = { ...ALL_DATASETS };

const DATASET_ICONS: Record<ExportDatasetId, typeof FileText> = {
  summary: FileText,
  domains: FileText,
  ips: FileText,
  rules: FileText,
  countries: FileText,
  proxies: FileText,
  devices: FileText,
};

const FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  icon: typeof FileText;
  accent: string;
}> = [
  { value: "json", icon: FileJson, accent: "text-amber-600 dark:text-amber-400" },
  { value: "csv", icon: FileText, accent: "text-emerald-600 dark:text-emerald-400" },
  { value: "xlsx", icon: FileSpreadsheet, accent: "text-blue-600 dark:text-blue-400" },
];

interface ExportContentProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange, preset: TimePreset) => void;
  activeBackendId?: number;
  activeBackendName: string;
  backendStatus: BackendStatus;
}

function formatBeijingDateTime(iso: string): string {
  return formatExportDateTime(iso).slice(0, 16) || "-";
}

export function ExportContent({
  timeRange,
  onTimeRangeChange,
  activeBackendId,
  activeBackendName,
  backendStatus,
}: ExportContentProps) {
  const t = useTranslations("export");
  const locale = useLocale();
  const [selected, setSelected] =
    useState<Record<ExportDatasetId, boolean>>(ALL_DATASETS_SELECTED);
  const [topN, setTopN] = useState<ExportTopN>(50);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [isExporting, setIsExporting] = useState(false);
  const [historyDismissed, setHistoryDismissed] = useState(false);
  const { latest: lastExport, record: recordExport } = useExportHistory(
    activeBackendId,
  );

  const selectedCount = EXPORT_DATASET_IDS.filter((id) => selected[id]).length;
  const allSelected = selectedCount === EXPORT_DATASET_IDS.length;
  const noneSelected = selectedCount === 0;
  const exportWindow = useMemo(() => getExportWindow(timeRange), [timeRange]);
  const exportRange = exportWindow?.range;
  const hourlyAlignment = !!exportRange &&
    Date.parse(timeRange.end) - Date.parse(timeRange.start) > 6 * 60 * 60 * 1000 &&
    (formatBeijingDateTime(exportRange.start) !== formatBeijingDateTime(timeRange.start) ||
      formatBeijingDateTime(exportRange.end) !== formatBeijingDateTime(timeRange.end));
  const continuationRange = lastExport?.endExclusive
    ? getExportContinuationRange(lastExport.end)
    : null;

  const { sources, isLoading, error, refetch } = useExportSources({
    backendId: activeBackendId,
    timeRange: exportWindow?.queryRange,
    topN,
    enabled: selected,
  });

  const datasets = useMemo(
    () =>
      buildExportDatasets({
        sources,
        enabled: selected,
        topN,
        timeRange: exportRange ?? timeRange,
        backendName: activeBackendName,
        locale,
      }),
    [sources, selected, topN, exportRange, timeRange, activeBackendName, locale],
  );

  const rowCounts = useMemo(() => {
    const counts: Partial<Record<ExportDatasetId, number>> = {};
    for (const dataset of datasets) {
      counts[dataset.id] = dataset.rows.length;
    }
    return counts;
  }, [datasets]);

  const toggleDataset = (id: ExportDatasetId) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const next = !allSelected;
    setSelected(
      EXPORT_DATASET_IDS.reduce(
        (acc, id) => ({ ...acc, [id]: next }),
        {} as Record<ExportDatasetId, boolean>,
      ),
    );
  };

  const handleExport = async () => {
    if (
      noneSelected || !datasets.length || isExporting || isLoading ||
      error || !activeBackendId || !exportRange
    ) return;
    const meta: ExportFileMeta = {
      backendName: activeBackendName,
      start: exportRange.start,
      end: exportRange.end,
      endExclusive: true,
      requestedRange: { ...timeRange },
      topN,
      exportedAt: new Date(),
    };
    const filename = getExportFileName(format, meta);
    setIsExporting(true);
    try {
      if (format === "json") {
        const json = buildExportJson(datasets, meta, locale);
        downloadBlob(
          filename,
          new Blob([json], { type: "application/json;charset=utf-8" }),
        );
      } else if (format === "csv") {
        const csv = buildExportCsv(datasets, meta, locale);
        downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
      } else {
        const blob = await buildExportXlsxBlob(datasets, meta, locale);
        downloadBlob(filename, blob);
      }
      recordExport({
        backendId: activeBackendId,
        backendName: activeBackendName,
        start: exportRange.start,
        end: exportRange.end,
        endExclusive: true,
        exportedAt: new Date().toISOString(),
        topN,
        format,
        datasets: EXPORT_DATASET_IDS.filter((id) => selected[id]),
        fileName: filename,
        rowCount: datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0),
      });
      // The hint now refers to the export that just finished.
      setHistoryDismissed(false);
      toast.success(t("toast.successTitle"), {
        description: t("toast.successDescription", { file: filename }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("toast.errorTitle"), { description: message });
    } finally {
      setIsExporting(false);
    }
  };

  const backendUnavailable = backendStatus === "unhealthy" || !activeBackendId;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Download className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{t("title")}</h2>
                <p className="max-w-xl text-sm text-muted-foreground">
                  {t("description")}
                </p>
                <p className="pt-1 text-xs text-muted-foreground/80">
                  {t("selectedRange", {
                    start: formatBeijingDateTime(timeRange.start),
                    end: formatBeijingDateTime(timeRange.end),
                  })}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  {exportRange ? t("currentRange", {
                    start: formatBeijingDateTime(exportRange.start),
                    end: formatBeijingDateTime(exportRange.end),
                  }) : t("noCompleteBuckets")}
                </p>
                {hourlyAlignment && <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{t("hourAlignmentHint")}</p>}
                <p className="text-xs text-muted-foreground/80">{t("timeZoneHint")}</p>
              </div>
            </div>
            <div className="flex max-w-full flex-col items-start gap-2 sm:items-end lg:max-w-sm">
              <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />
              <span className="text-xs text-muted-foreground">
                {t("rangeHint")}
              </span>
            </div>
          </div>

          {lastExport && !historyDismissed && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground">
                    {t("history.lastExportEnd", {
                      end: formatBeijingDateTime(lastExport.end),
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {lastExport.endExclusive ? t("history.suggestion", {
                      end: formatBeijingDateTime(lastExport.end),
                    }) : t("history.legacyRange")}
                    {" · "}
                    {t("history.meta", {
                      time: formatBeijingDateTime(lastExport.exportedAt),
                      rows: lastExport.rowCount,
                    })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pl-6 sm:pl-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={!continuationRange}
                  onClick={() => {
                    if (!continuationRange) return;
                    onTimeRangeChange(
                      continuationRange,
                      "custom",
                    );
                    setHistoryDismissed(true);
                  }}>
                  <ArrowRight className="mr-1 h-3 w-3" />
                  {t("history.continueAction")}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={t("history.dismiss")}
                  onClick={() => setHistoryDismissed(true)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {backendUnavailable && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t("backendUnavailable")}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Dataset selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                {t("datasets.title")}
              </CardTitle>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-primary hover:underline">
                {allSelected ? t("datasets.clearAll") : t("datasets.selectAll")}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {EXPORT_DATASET_IDS.map((id) => {
                const checked = selected[id];
                const Icon = DATASET_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleDataset(id)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 bg-secondary/30 hover:border-border hover:bg-secondary/50",
                    )}>
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-transparent group-hover:border-primary/40",
                      )}>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {t(`datasets.items.${id}.label`)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {t(`datasets.items.${id}.description`)}
                      </span>
                      {checked && (
                        <span className="mt-1 block text-[11px] font-medium text-primary/80">
                          {rowCounts[id] !== undefined
                            ? t("datasets.rowCount", { count: rowCounts[id] ?? 0 })
                            : t("datasets.loading")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("topN.label")}
                </span>
                <Tabs
                  value={String(topN)}
                  onValueChange={(value) => setTopN(Number(value) as ExportTopN)}>
                  <TabsList className="h-auto min-h-8 max-w-full flex-wrap">
                    {EXPORT_TOP_N_OPTIONS.map((option) => (
                      <TabsTrigger
                        key={option}
                        value={String(option)}
                        className="px-3 text-xs">
                        Top {option}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <p className="text-xs text-muted-foreground sm:max-w-[220px] sm:text-right">
                {t("topN.hint", { count: topN })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Format + action */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              {t("format.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((option) => {
                const active = format === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all",
                      active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/60 hover:border-border hover:bg-secondary/50",
                    )}>
                    <Icon className={cn("h-5 w-5 shrink-0", option.accent)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {t(`format.options.${option.value}.label`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`format.options.${option.value}.description`)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-primary" : "border-border",
                      )}>
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
              {t("summaryLine", {
                datasets: selectedCount,
                rows: datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0),
              })}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="break-words">{t("loadError")}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => void refetch()}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    {t("retry")}
                  </Button>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={noneSelected || isExporting || isLoading || !!error || !activeBackendId || !exportRange}
              onClick={() => void handleExport()}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting ? t("exporting") : t("exportButton")}
            </Button>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block text-center text-[11px] text-muted-foreground">
                    {noneSelected
                      ? t("emptySelection")
                      : !exportRange
                        ? t("noCompleteBuckets")
                        : isLoading
                          ? t("loadingData")
                          : t("readyHint")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px]">
                  <p className="text-xs">{t("privacyHint")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
