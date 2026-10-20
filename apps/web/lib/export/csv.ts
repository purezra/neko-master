import type { ExportDataset } from "./dataset";
import { getColumnLabel, getDatasetLabel } from "./dataset";
import { formatExportRange, formatExportTimestamp, getExportDisplayCell, toPlainCellValue, type ExportFileMeta } from "./file";

function escapeCsvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serializes every selected dataset into one CSV document.
 * Datasets are separated by a blank line and preceded by a `# <label>` header,
 * which keeps the file readable while staying valid CSV.
 */
export function buildExportCsv(
  datasets: ExportDataset[],
  meta: ExportFileMeta,
  locale: string,
): string {
  const lines: string[] = [
    escapeCsvCell("neko-master export"),
    escapeCsvCell(
      [
        `${locale.startsWith("zh") ? "网关" : "Backend"}: ${meta.backendName}`,
        `${locale.startsWith("zh") ? "时间范围" : "Range"}: ${formatExportRange(meta)}`,
        `Top ${meta.topN}${datasets.some(dataset => dataset.id === "deviceDetails") ? locale.startsWith("zh") ? "（设备明细全量）" : " (all device details)" : ""}`,
        `${locale.startsWith("zh") ? "导出时间" : "Exported"}: ${formatExportTimestamp(meta.exportedAt)}`,
      ].join(" | "),
    ),
  ];

  for (const dataset of datasets) {
    lines.push("");
    lines.push(
      escapeCsvCell(`# ${getDatasetLabel(dataset, locale)} (${dataset.rows.length})`),
    );
    lines.push(
      dataset.columns
        .map((column) => escapeCsvCell(getColumnLabel(column, locale)))
        .join(","),
    );
    for (const [rowIndex] of dataset.rows.entries()) {
      lines.push(
        dataset.columns
          .map((column) => escapeCsvCell(toPlainCellValue(getExportDisplayCell(dataset, rowIndex, column.key))))
          .join(","),
      );
    }
  }

  // BOM keeps Excel from mangling non-ASCII text on Windows.
  return `﻿${lines.join("\r\n")}\r\n`;
}
