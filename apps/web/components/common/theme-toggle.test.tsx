import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const state = vi.hoisted(() => ({ theme: undefined as string | undefined, systemTheme: undefined as string | undefined }));
vi.mock("next-themes", () => ({ useTheme: () => ({ ...state, setTheme: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

describe("theme hydration", () => {
  it("renders identical initial SVG markup regardless of a stored light preference", () => {
    state.theme = undefined; state.systemTheme = undefined;
    const server = renderToString(<ThemeToggle />);
    state.theme = "light"; state.systemTheme = "light";
    const savedLight = renderToString(<ThemeToggle />);
    expect(savedLight).toContain('lucide-moon');
    expect(server.replace(/«[^»]+»/g, "id")).toEqual(savedLight.replace(/«[^»]+»/g, "id"));
  });
});
