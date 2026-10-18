import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExportContent } from "./export-content";

const state = vi.hoisted(() => ({ isLoading: false, error: null as string | null }));
vi.mock("./use-export-sources", () => ({ useExportSources: () => ({
  ...state, sources: { domains: [], ips: [], rules: [], countries: [], devices: [], proxies: [] }, refetch: vi.fn(),
}) }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("@/components/common", () => ({ TimeRangePicker: () => null }));
vi.mock("@/lib/export/history", () => ({ useExportHistory: () => ({ latest: null, record: vi.fn() }) }));

describe("export button readiness", () => {
  it.each([
    [true, null, 1, true],
    [false, "request failed", 1, true],
    [false, null, undefined, true],
    [false, null, 1, false],
  ] as const)("loading=%s error=%s backend=%s disables=%s", (isLoading, error, backendId, disabled) => {
    state.isLoading = isLoading;
    state.error = error;
    const html = renderToString(<ExportContent
      timeRange={{ start: "2026-10-14T00:00:00Z", end: "2026-10-14T01:00:00Z" }}
      onTimeRangeChange={vi.fn()} activeBackendId={backendId} activeBackendName="test" backendStatus="healthy"
    />);
    const button = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((node) => node.includes("exportButton"));
    expect(button).toBeDefined();
    expect(button!.includes("disabled=")).toBe(disabled);
  });
});
