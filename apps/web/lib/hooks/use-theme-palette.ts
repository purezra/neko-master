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
    const palette = resolveThemePalette(hydrated ? forcedTheme ?? theme : undefined, hydrated ? systemTheme : undefined);
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
