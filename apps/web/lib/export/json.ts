import type { ExportDataset } from "./dataset";
import { toPlainRows, type ExportFileMeta } from "./file";

export interface ExportJsonPayload {
  meta: {
    app: "neko-master";
    version: string;
    backend: string;
    range: { start: string; end: string };
    topN: number;
    exportedAt: string;
    datasets: string[];
  };
  datasets: Record<
    string,
    {
      label: string;
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
      range: { start: meta.start, end: meta.end },
      topN: meta.topN,
      exportedAt: meta.exportedAt.toISOString(),
      datasets: datasets.map((dataset) => dataset.id),
    },
    datasets: Object.fromEntries(
      datasets.map((dataset) => [
        dataset.id,
        {
          label: localized(dataset.label),
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
