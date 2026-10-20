import type { ExportDataset } from "./dataset";
import { toPlainRows, formatExportTimestamp, EXPORT_TIME_ZONE, EXPORT_UTC_OFFSET, type ExportFileMeta } from "./file";

export interface ExportJsonPayload {
  meta: {
    app: "neko-master";
    version: string;
    backend: string;
    range: { start: string; end: string; endExclusive: boolean };
    requestedRange?: { start: string; end: string };
    topN: number;
    exportedAt: string;
    timeZone: string;
    utcOffset: string;
    datasets: string[];
  };
  datasets: Record<
    string,
    {
      label: string;
      /** null means all retained detail rows, independent of the global Top N. */
      topN: number | null;
      columns: Array<{ key: string; label: string }>;
      rows: Array<Record<string, string | number | boolean | null>>;
    }
  >;
}

export function buildExportJsonPayload(
  datasets: ExportDataset[],
  meta: ExportFileMeta,
  locale: string,
): ExportJsonPayload {
  const localized = (labels: { zh: string; en: string }) =>
    locale.startsWith("zh") ? labels.zh : labels.en;

  return {
    meta: {
      app: "neko-master",
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0",
      backend: meta.backendName,
      range: { start: formatExportTimestamp(meta.start), end: formatExportTimestamp(meta.end), endExclusive: !!meta.endExclusive },
      ...(meta.requestedRange ? { requestedRange: {
        start: formatExportTimestamp(meta.requestedRange.start),
        end: formatExportTimestamp(meta.requestedRange.end),
      } } : {}),
      topN: meta.topN,
      exportedAt: formatExportTimestamp(meta.exportedAt),
      timeZone: EXPORT_TIME_ZONE,
      utcOffset: EXPORT_UTC_OFFSET,
      datasets: datasets.map((dataset) => dataset.id),
    },
    datasets: Object.fromEntries(
      datasets.map((dataset) => [
        dataset.id,
        {
          label: localized(dataset.label),
          topN: dataset.id === "deviceDetails" || dataset.id === "summary" ? null : meta.topN,
          columns: dataset.columns.map((column) => ({
            key: column.key,
            label: localized(column.label),
          })),
          rows: toPlainRows(dataset),
        },
      ]),
    ),
  };
}

export function buildExportJson(
  datasets: ExportDataset[],
  meta: ExportFileMeta,
  locale: string,
): string {
  return JSON.stringify(buildExportJsonPayload(datasets, meta, locale), null, 2);
}
