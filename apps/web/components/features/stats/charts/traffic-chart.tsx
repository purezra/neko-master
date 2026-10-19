"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLocale } from "next-intl";
import type { HourlyStats } from "@neko-master/shared";
import { formatBytes } from "@/lib/utils";
import { useThemePalette } from "@/lib/hooks/use-theme-palette";

interface TrafficChartProps {
  data: HourlyStats[];
}

export function TrafficChart({ data }: TrafficChartProps) {
  const locale = useLocale();

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((item) => ({
      time: new Date(item.hour).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      download: item.download,
      upload: item.upload,
    }));
  }, [data, locale]);

  const { palette } = useThemePalette();
  const downloadColor = palette.colors.blue;
  const uploadColor = palette.colors.mauve;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={downloadColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={downloadColor} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={uploadColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={uploadColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--border)" 
            opacity={0.5}
          />
          <XAxis
            dataKey="time"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => formatBytes(value, 0)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              color: "var(--foreground)",
              boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.3)",
            }}
            formatter={(value, name) => [
              formatBytes(Number(value)),
              name === "download" ? "Download" : "Upload",
            ]}
            labelStyle={{ color: "var(--muted-foreground)", marginBottom: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="download"
            name="download"
            stroke={downloadColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorDownload)"
            animationDuration={1000}
          />
          <Area
            type="monotone"
            dataKey="upload"
            name="upload"
            stroke={uploadColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorUpload)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
