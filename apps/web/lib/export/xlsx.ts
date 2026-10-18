import type { Sheet, SheetData } from "write-excel-file/browser";
import type { ExportDataset } from "./dataset";
import { getColumnLabel, getDatasetLabel } from "./dataset";
import { formatExportRange, type ExportFileMeta } from "./file";

const HEADER_BACKGROUND = "#1d4ed8";
const HEADER_TEXT = "#ffffff";
const BORDER_COLOR = "#d4d4d8";

// Excel sheet names: max 31 chars, and none of : \ / ? * [ ]
const INVALID_SHEET_CHARS = /[:\\/?*[\]]/g;

function toSheetName(label: string, fallback: string, used: Set<string>): string {
  const base = (label.replace(INVALID_SHEET_CHARS, " ").trim() || fallback).slice(0, 31);
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const tail = ` ${suffix}`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

function buildSheet(
  dataset: ExportDataset,
  meta: ExportFileMeta,
  locale: string,
  usedNames: Set<string>,
): Sheet<Blob> {
  const data: SheetData = [];

  data.push([
    {
      value: `${getDatasetLabel(dataset, locale)} · ${meta.backendName}`,
      fontWeight: "bold",
      fontSize: 12,
      columnSpan: Math.max(dataset.columns.length, 2),
    },
  ]);
  data.push([
    {
      value: `${formatExportRange(meta)} · Top ${meta.topN}`,
      textColor: "#71717a",
      fontSize: 10,
      columnSpan: Math.max(dataset.columns.length, 2),
    },
  ]);
  data.push([]);

  data.push(
    dataset.columns.map((column) => ({
      value: getColumnLabel(column, locale),
      fontWeight: "bold" as const,
      backgroundColor: HEADER_BACKGROUND,
      textColor: HEADER_TEXT,
      align: "center" as const,
      borderColor: BORDER_COLOR,
      borderStyle: "thin" as const,
      height: 22,
    })),
  );

  for (const row of dataset.rows) {
    data.push(
      dataset.columns.map((column) => {
        const raw = row[column.key];
        if (raw instanceof Date) {
          if (Number.isNaN(raw.getTime())) return null;
          return {
            value: raw,
            type: Date,
            format: "yyyy-mm-dd hh:mm:ss",
            align: "center" as const,
          };
        }
        if (typeof raw === "number") {
          return {
            value: Number.isFinite(raw) ? raw : 0,
            type: Number,
            align: "right" as const,
          };
        }
        return {
          value: raw === null || raw === undefined ? "" : String(raw),
          type: String,
        };
      }),
    );
  }

  const widths = dataset.columns.map((column) => {
    let maxLength = getColumnLabel(column, locale).length;
    for (const row of dataset.rows.slice(0, 200)) {
      const value = row[column.key];
      const length = value instanceof Date ? 19 : String(value ?? "").length;
      if (length > maxLength) maxLength = length;
    }
    return { width: Math.min(Math.max(maxLength + 4, 12), 48) };
  });

  return {
    data,
    sheet: toSheetName(getDatasetLabel(dataset, locale), dataset.id, usedNames),
    columns: widths,
    stickyRowsCount: 4,
  };
}

export async function buildExportXlsxBlob(
  datasets: ExportDataset[],
  meta: ExportFileMeta,
  locale: string,
): Promise<Blob> {
  const usedNames = new Set<string>();
  const sheets = datasets.map((dataset) =>
    buildSheet(dataset, meta, locale, usedNames),
  );
  // Loaded on demand so the xlsx writer (~1.8 MB) stays out of the dashboard bundle.
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  return writeXlsxFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toBlob();
}
