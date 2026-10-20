"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, type TimeRange } from "@/lib/api";
import { getDevicesQueryKey, getDeviceProfilesQueryKey } from "@/lib/stats-query-keys";
import { Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function useDeviceCatalog(backendId?: number, range?: TimeRange, enabled = true) {
  const devices = useQuery({ queryKey: getDevicesQueryKey(backendId, 5000, range),
    queryFn: () => api.getDevices(backendId, 5000, range), enabled: !!backendId && enabled, staleTime: 60_000 });
  const profiles = useQuery({ queryKey: getDeviceProfilesQueryKey(backendId),
    queryFn: () => api.getDeviceProfiles(backendId!), enabled: !!backendId && enabled, staleTime: 60_000 });
  const catalog = new Map(devices.data?.map(device => [device.sourceIP, { sourceIP: device.sourceIP, displayName: device.displayName ?? "", groupName: device.groupName ?? "" }]));
  for (const profile of profiles.data ?? []) catalog.set(profile.sourceIP, profile);
  return { devices: [...catalog.values()].sort((a, b) => a.sourceIP.localeCompare(b.sourceIP)),
    isLoading: devices.isPending || profiles.isPending, isError: devices.isError || profiles.isError,
    refetch: () => Promise.all([devices.refetch(), profiles.refetch()]) };
}

export function DeviceScopeSelect({ backendId, range, value, onChange, devicesOnly = false }: {
  backendId?: number; range?: TimeRange; value: string; onChange: (value: string) => void; devicesOnly?: boolean;
}) {
  const t = useTranslations("deviceDetails");
  const catalog = useDeviceCatalog(backendId, range);
  const groups = [...new Set(catalog.devices.map(device => device.groupName).filter(Boolean))].sort();
  const known = value === "all" || value === "ungrouped" || value === "ip:" || catalog.devices.some(device => `ip:${device.sourceIP}` === value) || groups.some(group => `group:${group}` === value);
  return <div className="min-w-0 space-y-2">
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t("scope")} className="w-full min-w-0"><SelectValue placeholder={t("scope")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("allDevices")}</SelectItem>
        <SelectItem value="ip:">{t("unknownDevice")}</SelectItem>
        {!known && <SelectItem value={value}>{value.startsWith("ip:") ? value.slice(3) : value.startsWith("group:") ? value.slice(6) : value}</SelectItem>}
        {!devicesOnly && <><SelectItem value="ungrouped">{t("ungrouped")}</SelectItem><SelectSeparator />
          <SelectGroup><SelectLabel>{t("groups")}</SelectLabel>{groups.map(group => <SelectItem key={group} value={`group:${group}`}>{group}</SelectItem>)}</SelectGroup><SelectSeparator /></>}
        <SelectGroup><SelectLabel>{t("devices")}</SelectLabel>{catalog.devices.map(device => <SelectItem key={device.sourceIP} value={`ip:${device.sourceIP}`}>
          {device.displayName ? `${device.displayName} (${device.sourceIP})` : device.sourceIP}
        </SelectItem>)}</SelectGroup>
      </SelectContent>
    </Select>
    {catalog.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">{t("catalogError")}<Button size="sm" variant="outline" onClick={() => void catalog.refetch()}>{t("retry")}</Button></div>}
  </div>;
}
