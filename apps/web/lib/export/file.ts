import type { ExportDataset } from "./dataset";

export const EXPORT_FORMATS = ["json", "csv", "xlsx"] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_TIME_ZONE = "Asia/Shanghai";
export const EXPORT_UTC_OFFSET = "+08:00";
const exportClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: EXPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function formatExportTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(exportClock.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${String(date.getUTCMilliseconds()).padStart(3, "0")}${EXPORT_UTC_OFFSET}`;
}

export function formatExportDateTime(value: Date | string): string {
  return formatExportTimestamp(value).slice(0, 19).replace("T", " ");
}

/** Excel dates have no zone; the writer serializes Date.getTime() as UTC. */
export function toExportExcelDate(value: Date): Date {
  return new Date(`${formatExportTimestamp(value).slice(0, 23)}Z`);
}

export function formatExportTraffic(bytes: number): string {
  const value = Number.isFinite(bytes) ? bytes : 0;
  if (Math.abs(value) >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(4)} GB`;
  return Math.abs(value) >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(2)} MB` : `${(value / 1024).toFixed(2)} KB`;
}

export function getExportDisplayCell(dataset: ExportDataset, rowIndex: number, columnKey: string): unknown {
  const value = dataset.rows[rowIndex][columnKey];
  const isBytes = dataset.columns.find(column => column.key === columnKey)?.kind === "bytes" ||
    (columnKey === "value" && dataset.byteRows?.includes(rowIndex));
  return isBytes && typeof value === "number" ? formatExportTraffic(value) : value;
}

export interface ExportFileMeta {
  backendName: string;
  start: string;
  end: string;
  endExclusive?: boolean;
  /** The user's selection, used for the filename; start/end remain the actual data interval. */
  requestedRange?: { start: string; end: string };
  topN: number;
  exportedAt: Date;
  deviceScope?: string;
}

export function formatExportRange(meta: ExportFileMeta): string {
  const start = formatExportDateTime(meta.start), end = formatExportDateTime(meta.end);
  return `${meta.endExclusive ? `[${start}, ${end})` : `${start} ~ ${end}`} (UTC${EXPORT_UTC_OFFSET})`;
}

export function getExportFileStem(meta: ExportFileMeta): string {
  const stamp = (value: string) => formatExportTimestamp(value).slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const backend = (meta.backendName || "backend")
    .trim()
    .replace(/\s+(?:网关|gateway)$/iu, "")
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, "_")
    .replace(/\s+/g, "_")
    .slice(0, 40) || "backend";
  const range = meta.requestedRange ?? meta;
  const scope = meta.deviceScope && meta.deviceScope !== "all"
    ? `_${meta.deviceScope.replace(/[<>:"/\\|?*]|\p{Cc}/gu, "_").replace(/\s+/g, "_").slice(0, 64)}` : "";
  return `neko-master-${backend}${scope}_${stamp(range.start)}_${stamp(range.end)}`;
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
 * Dates keep their instant with an explicit China Standard Time offset.
 */
export function toPlainCellValue(
  value: unknown,
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatExportTimestamp(value);
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
