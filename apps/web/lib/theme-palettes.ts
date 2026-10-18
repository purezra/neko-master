import rawPalettes from "./theme-palettes.json";

/**
 * Color themes.
 *
 * The four Catppuccin flavors ship their full 26-slot semantic palette
 * (14 accents + Text/Subtext/Overlay/Surface/Base/Mantle/Crust); Dracula uses
 * the same slot names so every theme maps to the app's semantic tokens the
 * same way. `app/globals.css` holds the matching `[data-theme="..."]` blocks —
 * keep the two in sync.
 */
export type ThemePaletteId =
  | "mocha"
  | "macchiato"
  | "frappe"
  | "latte"
  | "dracula";

export type ThemeMode = "light" | "dark";

export interface ThemePalette {
  id: ThemePaletteId;
  name: string;
  mode: ThemeMode;
  accent: string;
  colors: Record<string, string>;
  chart: string[];
}

export const THEME_PALETTES = rawPalettes.palettes as ThemePalette[];

export const THEME_PALETTE_IDS = THEME_PALETTES.map((p) => p.id);

export const DEFAULT_DARK_THEME: ThemePaletteId = "mocha";

/**
 * Plain "light" keeps the original UniFi light theme defined in `:root`, so it
 * is not a selectable palette. Chart components still need concrete colors for
 * it, which this synthetic palette provides.
 */
export const CLASSIC_LIGHT_PALETTE: ThemePalette = {
  id: "light" as ThemePaletteId,
  name: "UniFi Light",
  mode: "light",
  accent: "blue",
  colors: {
    rosewater: "#f5f7fa",
    flamingo: "#e8ecf2",
    pink: "#ff6b9d",
    mauve: "#7b61ff",
    red: "#ef4444",
    maroon: "#f87171",
    peach: "#ff8c42",
    yellow: "#f59e0b",
    green: "#00d084",
    teal: "#14b8a6",
    sky: "#00c7ff",
    sapphire: "#0ea5e9",
    blue: "#0063ff",
    lavender: "#8b5cf6",
    text: "#1a1d29",
    subtext1: "#374151",
    subtext0: "#6b7280",
    overlay2: "#9ca3af",
    overlay1: "#cbd5e1",
    overlay0: "#e2e8f0",
    surface2: "#e8ecf2",
    surface1: "#eef2f7",
    surface0: "#e8ecf2",
    base: "#f5f7fa",
    mantle: "#ffffff",
    crust: "#ffffff",
  },
  chart: [
    "#0063ff", "#7b61ff", "#00c7ff", "#00d084", "#ff8c42",
    "#ef4444", "#ff6b9d", "#6366f1", "#14b8a6", "#f97316",
    "#0ea5e9", "#f87171", "#8b5cf6", "#22d3ee",
  ],
};

export function getThemePalette(id: string | undefined): ThemePalette {
  if (id === "light") return CLASSIC_LIGHT_PALETTE;
  return (
    THEME_PALETTES.find((palette) => palette.id === id) ??
    THEME_PALETTES.find((palette) => palette.id === DEFAULT_DARK_THEME)!
  );
}

export function isThemePaletteId(value: string | undefined): value is ThemePaletteId {
  return !!value && THEME_PALETTE_IDS.includes(value as ThemePaletteId);
}

/**
 * Resolve a next-themes value (`light`, `dark`, `system`, or a palette id)
 * to a concrete palette, honouring the OS preference for `system`.
 */
export function resolveThemePalette(
  theme: string | undefined,
  systemTheme: string | undefined,
): ThemePalette {
  if (isThemePaletteId(theme)) return getThemePalette(theme);
  if (theme === "light") return CLASSIC_LIGHT_PALETTE;
  if (theme === "dark") return getThemePalette(DEFAULT_DARK_THEME);
  // Plain "system" follows the OS mode with the matching default palette.
  return systemTheme === "light"
    ? CLASSIC_LIGHT_PALETTE
    : getThemePalette(DEFAULT_DARK_THEME);
}

/** Page background used for the browser `theme-color` meta tag. */
export function getThemeBackgroundColor(palette: ThemePalette): string {
  return palette.colors.base;
}

/** Chart series colors for the active palette. */
export function getThemeChartColors(palette: ThemePalette): string[] {
  return palette.chart;
}
