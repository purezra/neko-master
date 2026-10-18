"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  getThemeBackgroundColor,
  isThemePaletteId,
  resolveThemePalette,
  THEME_PALETTES,
  THEME_PALETTE_IDS,
} from "@/lib/theme-palettes";

/**
 * next-themes values: the two plain modes plus every palette id. Palette ids
 * are mapped to their mode for the `class` attribute so `dark:` utilities keep
 * working; the palette id itself is mirrored onto `data-theme`.
 */
const THEME_VALUES = ["light", "dark", "system", ...THEME_PALETTE_IDS];

const THEME_CLASS_VALUES = Object.fromEntries([
  ["light", "light"],
  ["dark", "dark"],
  ...THEME_PALETTES.map((palette) => [palette.id, palette.mode]),
]);

function ThemeAttributeSync() {
  const { theme, systemTheme } = useTheme();

  React.useEffect(() => {
    const root = document.documentElement;
    const palette = resolveThemePalette(theme, systemTheme);

    if (isThemePaletteId(theme)) {
      root.setAttribute("data-theme", theme);
    } else {
      // Plain "light" / "dark" / "system" selections use the default palettes.
      root.setAttribute("data-theme", palette.id);
    }

    // `resolvedTheme` is the palette id when one is selected, so the mode comes
    // from the palette itself. Keep both mode classes in sync so `.light`- and
    // `.dark`-scoped rules work for every theme value.
    const isDark = palette.mode === "dark";
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    root.style.colorScheme = isDark ? "dark" : "light";

    const color = getThemeBackgroundColor(palette);
    const metas = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (metas.length > 0) {
      metas.forEach((meta) => {
        meta.removeAttribute("media");
        meta.setAttribute("content", color);
      });
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, [theme, systemTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={THEME_VALUES}
      value={THEME_CLASS_VALUES}
      {...props}>
      <ThemeAttributeSync />
      {children}
    </NextThemesProvider>
  );
}
