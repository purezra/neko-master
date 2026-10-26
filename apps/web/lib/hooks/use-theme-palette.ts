"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import {
  getThemeChartColors,
  resolveThemePalette,
  type ThemePalette,
} from "@/lib/theme-palettes";

export interface ThemePaletteState {
  palette: ThemePalette;
  /** True for any dark palette (drives existing light/dark branching). */
  isDark: boolean;
  /** Ordered series colors for the active palette. */
  chartColors: string[];
}

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * next-themes' blocking script puts the resolved mode class on <html> before
 * the first paint, but its React state (`theme`/`systemTheme`) only appears
 * after mount. Reading the class lets the first post-hydration render resolve
 * the real palette instead of waiting an extra render on the Mocha fallback.
 */
function getDocumentMode(): string | undefined {
  const classes = document.documentElement.classList;
  return classes.contains("dark") ? "dark" : classes.contains("light") ? "light" : undefined;
}

/**
 * Active color palette + chart series colors.
 *
 * `resolvedTheme` is undefined until next-themes hydrates; palette lookups
 * fall back to Mocha, which matches the server-rendered dark defaults.
 */
export function useThemePalette(): ThemePaletteState {
  const { theme, systemTheme, forcedTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return useMemo(() => {
    // SSR and the first hydration render must agree, even when localStorage
    // already contains a light theme. Resolve the saved theme after hydration.
    const selected = hydrated ? forcedTheme ?? theme : undefined;
    // "system" needs the OS mode; next-themes fills `systemTheme` in an effect,
    // so fall back to the class its blocking script already applied.
    const system = hydrated ? systemTheme ?? getDocumentMode() : undefined;
    const palette = resolveThemePalette(selected, system);
    return {
      palette,
      isDark: palette.mode === "dark",
      chartColors: getThemeChartColors(palette),
    };
  }, [theme, systemTheme, forcedTheme, hydrated]);
}

/** Cycle through the palette's series colors. */
export function colorAt(colors: string[], index: number): string {
  return colors[index % colors.length];
}
