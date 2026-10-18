"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { CountryFlag } from "./country-flag";
import { OverviewCard } from "@/components/common";
import { TopListItem } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useCountryName } from "@/lib/i18n-country";
import { useThemePalette } from "@/lib/hooks/use-theme-palette";
import { getContinentColor } from "@/lib/continent-colors";
import type { CountryStats } from "@neko-master/shared";

interface CountryTopListProps {
  data: CountryStats[];
  limit?: number;
  onViewAll?: () => void;
}

export function CountryTopList({ data, limit = 7, onViewAll }: CountryTopListProps) {
  const t = useTranslations("topCountries");
  const countriesT = useTranslations("countries");
  const countryName = useCountryName();
  const { palette } = useThemePalette();

  const { countries, totalTraffic } = useMemo(() => {
    if (!data) return { countries: [], totalTraffic: 0 };
    const list = data
      .filter(c => c.country !== "LOCAL" && c.country !== "Unknown")
      .slice(0, limit)
      .map(c => ({
        ...c,
        total: c.totalDownload + c.totalUpload,
        color: getContinentColor(c.continent, palette),
      }));
    const total = list.reduce((sum, c) => sum + c.total, 0);
    return { countries: list, totalTraffic: total };
  }, [data, limit, palette]);

  if (countries.length === 0) {
    return (
      <OverviewCard title={t("title")} icon={<MapPin className="w-4 h-4" />}>
        <div className="py-8 text-center text-sm text-muted-foreground">
          {countriesT("noData")}
        </div>
      </OverviewCard>
    );
  }

  return (
    <OverviewCard 
      title={t("title")} 
      icon={<MapPin className="w-4 h-4" />}
      footer={
        onViewAll && (
          <Button variant="ghost" size="sm" className="w-full h-9 text-xs" onClick={onViewAll}>
            {t("viewAll")}
          </Button>
        )
      }
    >
      <div className="space-y-1 min-h-[320px]">
        {countries.map((country, index) => (
          <TopListItem
            key={country.country}
            rank={index + 1}
            icon={<CountryFlag country={country.country} className="h-4 w-6" />}
            title={countryName(country.country)}
            subtitle={country.continent}
            value={country.total}
            total={totalTraffic}
            color={country.color}
          />
        ))}
      </div>
    </OverviewCard>
  );
}
