import type { ExportDataset } from "./dataset";

export const EXPORT_FORMATS = ["json", "csv", "xlsx"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFileMeta {
  backendName: string;
  start: string;
  end: string;
  endExclusive?: boolean;
  topN: number;
  exportedAt: Date;
}

export function formatExportRange(meta: ExportFileMeta): string {
  return meta.endExclusive
    ? `[${meta.start}, ${meta.end})`
    : `${meta.start} ~ ${meta.end}`;
}

export function getExportFileStem(meta: ExportFileMeta): string {
  const date = meta.exportedAt;
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const clock = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("");
  const backend = (meta.backendName || "backend")
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, "_")
    .trim()
    .slice(0, 40) || "backend";
  return `neko-master-${backend}-${stamp}-${clock}`;
}

export function getExportFileName(
  format: ExportFormat,
  meta: ExportFileMeta,
): string {
  return `${getExportFileStem(meta)}.${format}`;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Let the browser start the download before releasing the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Normalizes a cell value for plain-text formats (JSON / CSV).
 * Dates become ISO strings, numbers stay numeric.
 */
export function toPlainCellValue(
  value: unknown,
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") return value;
  return String(value);
}

export function toPlainRows(
  dataset: ExportDataset,
): Array<Record<string, string | number | boolean | null>> {
  return dataset.rows.map((row) => {
    const plain: Record<string, string | number | boolean | null> = {};
    for (const column of dataset.columns) {
      plain[column.key] = toPlainCellValue(row[column.key]);
    }
    return plain;
  });
}
