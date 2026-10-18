"use client";

import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { useThemePalette } from "@/lib/hooks/use-theme-palette";
import { THEME_PALETTES } from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

/** Localized display name per palette id (falls back to the English name). */
const PALETTE_LABEL_KEYS: Record<string, string> = {
  mocha: "palettes.mocha",
  macchiato: "palettes.macchiato",
  frappe: "palettes.frappe",
  latte: "palettes.latte",
  dracula: "palettes.dracula",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { palette, isDark } = useThemePalette();
  const t = useTranslations("theme");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-secondary"
          aria-label={t("toggle")}>
          {isDark ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4 text-amber-500" />
          {t("light")}
          {theme === "light" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4 text-indigo-500" />
          {t("dark")}
          {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4 text-slate-500" />
          {t("system")}
          {theme === "system" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          {t("palettes.title")}
        </DropdownMenuLabel>
        {THEME_PALETTES.map((item) => {
          const active = palette.id === item.id;
          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={cn("gap-2", active && "bg-muted")}>
              <span className="flex shrink-0 -space-x-1">
                <span
                  className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: item.colors.base }}
                />
                <span
                  className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: item.colors[item.accent] }}
                />
              </span>
              <span className="min-w-0 flex-1 truncate">
                {t(PALETTE_LABEL_KEYS[item.id] ?? item.id)}
              </span>
              {active ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {item.mode === "dark" ? t("modeDark") : t("modeLight")}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
