"use client";

import { useMemo } from "react";
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

/**
 * Active color palette + chart series colors.
 *
 * `resolvedTheme` is undefined until next-themes hydrates; palette lookups
 * fall back to Mocha, which matches the server-rendered dark defaults.
 */
export function useThemePalette(): ThemePaletteState {
  const { theme, systemTheme, forcedTheme } = useTheme();

  return useMemo(() => {
    const palette = resolveThemePalette(forcedTheme ?? theme, systemTheme);
    return {
      palette,
      isDark: palette.mode === "dark",
      chartColors: getThemeChartColors(palette),
    };
  }, [theme, systemTheme, forcedTheme]);
}

/** Cycle through the palette's series colors. */
export function colorAt(colors: string[], index: number): string {
  return colors[index % colors.length];
}
