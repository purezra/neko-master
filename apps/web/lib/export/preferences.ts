"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EXPORT_DATASET_IDS, EXPORT_TOP_N_OPTIONS, type ExportDatasetId, type ExportTopN } from "./dataset";
import { EXPORT_FORMATS, type ExportFormat } from "./file";

export interface ExportPreferences {
  selected: Record<ExportDatasetId, boolean>;
  topN: ExportTopN;
  format: ExportFormat;
  scope: string;
  splitSheets: boolean;
}
export const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = {
  selected: Object.fromEntries(EXPORT_DATASET_IDS.map(id => [id, true])) as Record<ExportDatasetId, boolean>,
  topN: 50, format: "json", scope: "all", splitSheets: false,
};
const defaults = JSON.stringify(DEFAULT_EXPORT_PREFERENCES);
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

export function parseExportPreferences(raw: string | null): ExportPreferences {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<ExportPreferences> | null;
    if (!value || typeof value !== "object") return DEFAULT_EXPORT_PREFERENCES;
    const selected = Object.fromEntries(EXPORT_DATASET_IDS.map(id => [id,
      typeof value.selected?.[id] === "boolean" ? value.selected[id] : true])) as Record<ExportDatasetId, boolean>;
    const scope = typeof value.scope === "string" && value.scope.length <= 256 &&
      (value.scope === "all" || value.scope === "ungrouped" || value.scope.startsWith("ip:") || value.scope.startsWith("group:")) ? value.scope : "all";
    return { selected, scope, topN: EXPORT_TOP_N_OPTIONS.includes(value.topN as ExportTopN) ? value.topN! : 50,
      format: EXPORT_FORMATS.includes(value.format as ExportFormat) ? value.format! : "json", splitSheets: value.splitSheets === true };
  } catch { return DEFAULT_EXPORT_PREFERENCES; }
}

function snapshot(key: string): string {
  if (memory.has(key)) return memory.get(key)!;
  try { return window.localStorage.getItem(key) ?? defaults; } catch { return defaults; }
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key) memory.delete(event.key); else memory.clear(); listener(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function useExportPreferences(backendId?: number) {
  const key = `neko-master:export-preferences:${backendId ?? "none"}`;
  const raw = useSyncExternalStore(subscribe, useCallback(() => snapshot(key), [key]), () => defaults);
  const preferences = useMemo(() => parseExportPreferences(raw), [raw]);
  const update = (patch: Partial<ExportPreferences>) => {
    const next = JSON.stringify({ ...parseExportPreferences(snapshot(key)), ...patch });
    memory.set(key, next);
    try { window.localStorage.setItem(key, next); } catch { /* Settings still work when storage is unavailable. */ }
    emit();
  };
  return { preferences, update };
}
