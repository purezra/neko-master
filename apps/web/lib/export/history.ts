"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ExportDatasetId } from "@/lib/export/dataset";
import type { ExportFormat } from "@/lib/export/file";

/**
 * Local export history. Kept in localStorage so the "continue from where you
 * left off" hint survives reloads without touching the collector API.
 *
 * One record is written per completed export; records are keyed by backend so
 * switching gateways does not mix ranges.
 */
export interface ExportHistoryRecord {
  id: string;
  backendId?: number;
  backendName: string;
  /** Actual exported range, ISO strings. Legacy records have an inclusive end. */
  start: string;
  end: string;
  endExclusive?: boolean;
  /** Wall-clock time the export completed. */
  exportedAt: string;
  topN: number;
  format: ExportFormat;
  datasets: ExportDatasetId[];
  fileName: string;
  rowCount: number;
}

const STORAGE_KEY = "neko-master:export-history";
const MAX_RECORDS = 50;

type HistoryMap = Record<string, ExportHistoryRecord[]>;

function backendKey(backendId: number | undefined): string {
  return backendId === undefined ? "all" : String(backendId);
}

function readAll(): HistoryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const map: HistoryMap = {};
    for (const [key, value] of Object.entries(parsed as HistoryMap)) {
      if (Array.isArray(value)) {
        map[key] = value.filter(
          (record): record is ExportHistoryRecord =>
            !!record &&
            typeof record.start === "string" &&
            typeof record.end === "string" &&
            typeof record.exportedAt === "string",
        );
      }
    }
    return map;
  } catch {
    return {};
  }
}

function writeAll(map: HistoryMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or blocked — export history is best-effort.
  }
}

/**
 * localStorage is the single source of truth. `useSyncExternalStore` needs a
 * referentially stable snapshot, so the latest record is memoized per backend
 * and invalidated whenever the store is written (here or in another tab).
 */
const listeners = new Set<() => void>();
let cachedKey: string | null = null;
let cachedRecord: ExportHistoryRecord | null = null;
let cacheValid = false;

function notify(): void {
  cacheValid = false;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", notify);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", notify);
    }
  };
}

function readLatest(key: string): ExportHistoryRecord | null {
  if (!cacheValid || cachedKey !== key) {
    cachedKey = key;
    cachedRecord = readAll()[key]?.[0] ?? null;
    cacheValid = true;
  }
  return cachedRecord;
}

export function getLatestExportRecord(
  backendId: number | undefined,
): ExportHistoryRecord | null {
  return readLatest(backendKey(backendId));
}

export function appendExportRecord(
  record: Omit<ExportHistoryRecord, "id">,
): ExportHistoryRecord {
  const stored: ExportHistoryRecord = {
    ...record,
    id: `${record.exportedAt}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const map = readAll();
  const key = backendKey(record.backendId);
  map[key] = [stored, ...(map[key] ?? [])].slice(0, MAX_RECORDS);
  writeAll(map);
  notify();
  return stored;
}

export function clearExportHistory(backendId: number | undefined): void {
  const map = readAll();
  delete map[backendKey(backendId)];
  writeAll(map);
  notify();
}

export function useExportHistory(backendId: number | undefined) {
  const key = backendKey(backendId);
  const latest = useSyncExternalStore(
    subscribe,
    useCallback(() => readLatest(key), [key]),
    useCallback(() => null, []),
  );

  const clear = useCallback(() => {
    clearExportHistory(backendId);
  }, [backendId]);

  return { latest, record: appendExportRecord, clear };
}
