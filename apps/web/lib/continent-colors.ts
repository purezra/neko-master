import type { ThemePalette } from "@/lib/theme-palettes";

/**
 * Continent → palette slot. Kept as semantic names (not hex) so every color
 * theme renders continents with its own accent colors.
 */
const CONTINENT_SLOTS: Record<string, string> = {
  AS: "peach",
  NA: "blue",
  EU: "mauve",
  SA: "green",
  AF: "red",
  OC: "sky",
  LOCAL: "overlay0",
  Unknown: "overlay1",
};

export function getContinentColor(
  continent: string,
  palette: ThemePalette,
): string {
  const slot = CONTINENT_SLOTS[continent] ?? CONTINENT_SLOTS.Unknown;
  return palette.colors[slot];
}
