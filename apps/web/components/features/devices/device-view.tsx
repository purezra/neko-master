"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Download, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import type { DeviceProfile, DeviceStats } from "@neko-master/shared";
import { api, type TimeRange } from "@/lib/api";
import { getDeviceProfilesQueryKey } from "@/lib/stats-query-keys";
import { filterDevices } from "@/lib/device-profiles";
import { buildExportDatasets } from "@/lib/export/dataset";
import { buildExportCsv } from "@/lib/export/csv";
import { downloadBlob, getExportFileName } from "@/lib/export/file";
import { useAuthState } from "@/lib/auth-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveDeviceStats } from "./interactive-device-stats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceTrafficDetails } from "./device-traffic-details";

interface DeviceViewProps {
  data: DeviceStats[];
  activeBackendId?: number;
  timeRange: TimeRange;
  backendStatus?: "healthy" | "unhealthy" | "unknown";
  autoRefresh: boolean;
}

export function DeviceView(props: DeviceViewProps) {
  const { data, activeBackendId, timeRange } = props;
  const t = useTranslations("devices");
  const detailsT = useTranslations("deviceDetails");
  const locale = useLocale();
  const client = useQueryClient();
  const { data: auth } = useAuthState();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState<DeviceProfile | null>(null);
  const profiles = useQuery({
    queryKey: getDeviceProfilesQueryKey(activeBackendId),
    queryFn: () => api.getDeviceProfiles(activeBackendId!),
    enabled: !!activeBackendId,
  });
  const filtered = useMemo(() => filterDevices(data, profiles.data, search, group), [data, profiles.data, search, group]);
  const groups = [...new Set(profiles.data?.map(profile => profile.groupName).filter(Boolean))].sort();
  const addresses = [...new Set([...data.map(device => device.sourceIP), ...(profiles.data?.map(profile => profile.sourceIP) ?? [])])].sort();
  const editAddress = (sourceIP: string) => setEditing(profiles.data?.find(profile => profile.sourceIP === sourceIP) ?? { sourceIP, displayName: "", groupName: "" });
  const save = useMutation({
    mutationFn: (profile: DeviceProfile) => api.saveDeviceProfile(activeBackendId!, profile),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: getDeviceProfilesQueryKey(activeBackendId) }),
        client.invalidateQueries({ queryKey: ["stats"] }),
      ]);
      setEditing(null);
      toast.success(t("saved"));
    },
    onError: () => toast.error(t("saveError")),
  });

  const exportFiltered = () => {
    const meta = { backendName: `gateway-${activeBackendId}`, ...timeRange, topN: filtered.length, exportedAt: new Date() };
    const datasets = buildExportDatasets({
      sources: { devices: filtered, domains: [], ips: [], countries: [], proxies: [], rules: [] },
      enabled: { devices: true, summary: false, domains: false, ips: false, countries: false, proxies: false, rules: false },
      topN: filtered.length, timeRange, backendName: meta.backendName, locale,
    });
    downloadBlob(getExportFileName("csv", meta), new Blob([buildExportCsv(datasets, meta, locale)], { type: "text/csv;charset=utf-8" }));
  };

  return <Tabs defaultValue="overview" className="min-w-0 space-y-4">
    <TabsList><TabsTrigger value="overview">{detailsT("overviewTab")}</TabsTrigger><TabsTrigger value="details">{detailsT("detailsTab")}</TabsTrigger></TabsList>
    <TabsContent value="details" className="min-w-0"><DeviceTrafficDetails backendId={activeBackendId} range={timeRange} /></TabsContent>
    <TabsContent value="overview" className="space-y-4">
    <Card><CardContent className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("search")} aria-label={t("search")} className="pl-9" />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-[180px]" aria-label={t("group")}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("allGroups")}</SelectItem><SelectItem value="ungrouped">{t("ungrouped")}</SelectItem>
            {groups.map(name => <SelectItem key={name} value={`group:${name}`}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!addresses.length || profiles.isPending || profiles.isError || auth?.showcaseMode || !activeBackendId} onClick={() => { save.reset(); editAddress(addresses[0]); }}>
          <Pencil className="mr-2 h-4 w-4" />{t("manage")}
        </Button>
        <Button variant="outline" disabled={!filtered.length || profiles.isPending || profiles.isError} onClick={exportFiltered}><Download className="mr-2 h-4 w-4" />{t("exportFiltered")}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("matched", { count: filtered.length })}</p>
      {profiles.isError && <div role="alert" className="flex items-center gap-3 text-sm text-destructive">{t("profilesError")}<Button variant="outline" size="sm" onClick={() => void profiles.refetch()}>{t("retry")}</Button></div>}
    </CardContent></Card>
    {data.length > 0 && !filtered.length
      ? <Card><CardContent className="space-y-3 p-8 text-center"><p className="text-sm text-muted-foreground">{t("noMatches")}</p><Button variant="outline" onClick={() => { setSearch(""); setGroup("all"); }}>{t("clearFilters")}</Button></CardContent></Card>
      : <InteractiveDeviceStats {...props} data={filtered.slice(0, 100)} />}
    </TabsContent>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !save.isPending) setEditing(null); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader><DialogTitle>{t("manage")}</DialogTitle><DialogDescription>{t("profileHint")}</DialogDescription></DialogHeader>
        {editing && <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(editing); }}>
          <div className="space-y-2"><Label htmlFor="profile-address">{t("address")}</Label>
            <Select value={editing.sourceIP} onValueChange={editAddress} disabled={save.isPending}><SelectTrigger id="profile-address"><SelectValue /></SelectTrigger><SelectContent>{addresses.map(ip => <SelectItem key={ip} value={ip}>{ip}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label htmlFor="profile-name">{t("name")}</Label><Input id="profile-name" maxLength={80} value={editing.displayName} disabled={save.isPending} onChange={event => setEditing({ ...editing, displayName: event.target.value })} placeholder={t("namePlaceholder")} /></div>
          <div className="space-y-2"><Label htmlFor="profile-group">{t("group")}</Label><Input id="profile-group" list="device-groups" maxLength={40} value={editing.groupName} disabled={save.isPending} onChange={event => setEditing({ ...editing, groupName: event.target.value })} placeholder={t("groupPlaceholder")} /><datalist id="device-groups">{groups.map(name => <option key={name} value={name} />)}</datalist></div>
          {save.isError && <p role="alert" className="text-sm text-destructive">{t("saveError")}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditing(null)}>{t("cancel")}</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? t("saving") : t("save")}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </Tabs>;
}
