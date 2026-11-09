"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Activity, ArrowRight, Check, HeartPulse, RefreshCw, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { DIAGNOSTIC_SERVICE_IDS, getDiagnosticConnectionStatus } from "@neko-master/shared";
import type { DiagnosticProxy, DiagnosticServiceId } from "@neko-master/shared";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { diagnosticKeys } from "@/lib/stats-query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/utils";

function searchTerm(value: string): string {
  try { return new URL(value).hostname; } catch { return value.trim(); }
}

function selectedLeaf(name: string, proxies: Record<string, DiagnosticProxy>): string | undefined {
  const visited = new Set<string>();
  while (!visited.has(name)) {
    visited.add(name);
    const proxy = proxies[name];
    if (!proxy?.all) return name;
    if (!proxy.now) return undefined;
    name = proxy.now;
  }
  return undefined;
}

export function ConnectionDiagnostics({ backendId, autoRefresh }: { backendId?: number; autoRefresh: boolean }) {
  const t = useTranslations("diagnostics");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("connections");
  const [minutes, setMinutes] = useState(3);
  const [minutesInput, setMinutesInput] = useState("3");
  const [search, setSearch] = useState("");
  const [service, setService] = useState<DiagnosticServiceId>();
  const [moreServices, setMoreServices] = useState(false);
  const [offset, setOffset] = useState(0);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodePage, setNodePage] = useState(0);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [policyChoices, setPolicyChoices] = useState<string[]>([]);
  const validMinutes = /^[1-5]$/.test(minutesInput);
  const connections = useQuery({
    queryKey: diagnosticKeys.connections(backendId ?? 0, minutes, searchTerm(search), offset, service),
    queryFn: () => api.getDiagnosticConnections(backendId!, minutes, searchTerm(search), offset, service),
    enabled: !!backendId && tab === "connections", refetchInterval: autoRefresh ? 2000 : false, retry: false,
  });
  const proxies = useQuery({
    queryKey: diagnosticKeys.proxies(backendId ?? 0), queryFn: () => api.getDiagnosticProxies(backendId!),
    enabled: !!backendId, refetchInterval: autoRefresh ? 30_000 : false, retry: false,
  });
  const healthStatus = useQuery({
    queryKey: diagnosticKeys.health(backendId ?? 0), queryFn: () => api.getDiagnosticHealth(backendId!),
    enabled: !!backendId && !!proxies.data, retry: false,
    refetchInterval: query => query.state.data?.running ? 1000 : autoRefresh ? 10_000 : false,
  });
  const healthResults = Object.fromEntries((healthStatus.data?.results ?? []).map(result => [result.id, result.delay]));
  const proxyMap = proxies.data?.proxies ?? {};
  const canControl = proxies.data?.canControl === true && !proxies.isError;
  const refreshProxies = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: diagnosticKeys.proxies(backendId!) }),
      queryClient.invalidateQueries({ queryKey: ["gatewayProxies", { backendId }] }),
      queryClient.invalidateQueries({ queryKey: ["gatewayProviders", { backendId }] }),
    ]);
  };
  const selection = useMutation({
    mutationFn: ({ group, name }: { group: string; name: string }) => api.selectDiagnosticProxy(backendId!, group, name),
    onSuccess: async () => { toast.success(t("switched")); await refreshProxies(); },
    onError: () => { toast.error(t("switchFailed")); void refreshProxies(); },
  });
  const health = useMutation({
    mutationFn: (name?: string) => api.checkDiagnosticHealth(backendId!, name),
    onSuccess: (job) => {
      queryClient.setQueryData(diagnosticKeys.health(backendId!), job);
      void refreshProxies();
    },
    onError: () => toast.error(t("healthFailed")),
  });
  const testing = health.isPending || healthStatus.data?.running === true;
  const close = useMutation({
    mutationFn: (id: string) => api.closeDiagnosticConnection(backendId!, id),
    onSuccess: () => { toast.success(t("closed")); void connections.refetch(); },
    onError: () => toast.error(t("closeFailed")),
  });
  const unsupported = [connections.error, proxies.error].some(error => error instanceof ApiError && error.status === 409);
  const groups = Object.entries(proxyMap).filter(([, proxy]) => Array.isArray(proxy.all));
  const allNodes = proxies.data?.nodes ?? [];
  const nodes = allNodes.filter(node => `${node.name} ${node.type} ${node.provider ?? node['provider-name'] ?? ''}`.toLowerCase().includes(nodeSearch.toLowerCase()));
  const nodeIdsByName = new Map<string, string>();
  for (const node of allNodes) if (!nodeIdsByName.has(node.name)) nodeIdsByName.set(node.name, node.id);
  const sampledAt = connections.data?.sampledAt;
  const stale = !sampledAt || connections.dataUpdatedAt - sampledAt > 15_000;
  const latency = (name: string, proxy?: DiagnosticProxy) => {
    const delay = Object.hasOwn(healthResults, name) ? healthResults[name] : proxy?.history?.at(-1)?.delay;
    if (delay === null || delay === 0 || proxy?.alive === false && !Object.hasOwn(healthResults, name)) return t("unreachable");
    return delay !== undefined ? `${delay} ms` : t("untested");
  };
  const errorView = (retry: () => void) => <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
    <p>{t("loadFailed")}</p><Button variant="outline" size="sm" onClick={retry}>{t("retry")}</Button>
  </div>;
  const groupEditor = (name: string, proxy: DiagnosticProxy) => <div className="space-y-3">
    <div className="flex items-center justify-between gap-2"><Badge variant="secondary">{proxy.type}</Badge><span className="text-xs text-muted-foreground">{t("members", { count: proxy.all?.length ?? 0 })}</span></div>
    <p className="break-all text-sm text-muted-foreground">{t("current")}: <span className="font-medium text-foreground">{proxy.now || t("automatic")}</span></p>
    {proxy.type === "Selector" ? <Select value={proxy.now || undefined} disabled={!canControl || selection.isPending}
      onValueChange={value => selection.mutate({ group: name, name: value })}>
      <SelectTrigger className="w-full" aria-label={t("switchGroup", { group: name })}><SelectValue placeholder={t("chooseNode")} /></SelectTrigger>
      <SelectContent>{proxy.all?.map(member => <SelectItem key={member} value={member}>
        {member} · {proxyMap[member]?.all ? proxyMap[member].type : latency(nodeIdsByName.get(member) ?? member, proxyMap[member])}
      </SelectItem>)}</SelectContent>
    </Select> : <p className="text-xs text-muted-foreground">{t("automaticGroup")}</p>}
  </div>;

  if (!backendId) return <Card><CardContent className="py-10 text-center text-muted-foreground">{t("noBackend")}</CardContent></Card>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Activity className="size-6" />{t("title")}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("description")}</p></div>
      <Button variant="outline" disabled={connections.isFetching || proxies.isFetching} onClick={() => { void connections.refetch(); void proxies.refetch(); }}>
        <RefreshCw className="size-4" />{t("refresh")}</Button>
    </div>
    {unsupported ? <Card><CardContent className="py-8 text-sm text-muted-foreground">{t("unsupported")}</CardContent></Card> : <Tabs value={tab} onValueChange={setTab}>
      <TabsList><TabsTrigger value="connections">{t("connections")}</TabsTrigger><TabsTrigger value="nodes">{t("nodes")}</TabsTrigger></TabsList>
      <TabsContent value="connections" className="mt-5 space-y-4">
        <Card><CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input className="pl-9" value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setOffset(0); }} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} /></div>
            <label className="flex items-center gap-2 text-sm">{t("recent")}<Input type="number" min={1} max={5} step={1} value={minutesInput} className="w-20" aria-invalid={!validMinutes}
              onChange={event => { const value = event.target.value; setMinutesInput(value); if (/^[1-5]$/.test(value)) { setMinutes(Number(value)); setOffset(0); } }} />{t("minutes")}</label>
            <Badge variant="outline">{t(autoRefresh ? "live" : "paused")}</Badge>
          </div>
          <div role="group" aria-label={t("quickFilters")} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-muted-foreground">{t("quickFilters")}</span>
            <Button size="sm" variant={service === undefined ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" aria-pressed={service === undefined} onClick={() => { setService(undefined); setOffset(0); }}>{t("allServices")}</Button>
            {DIAGNOSTIC_SERVICE_IDS.filter((id, index) => index < 7 || moreServices || id === service).map(id =>
              <Button key={id} size="sm" variant={service === id ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" aria-pressed={service === id}
                onClick={() => { setService(service === id ? undefined : id); setOffset(0); }}>{t(`services.${id}`)}</Button>)}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-expanded={moreServices} onClick={() => setMoreServices(value => !value)}>{t(moreServices ? "fewerServices" : "moreServices")}</Button>
          </div>
          {!validMinutes && <p className="text-sm text-destructive">{t("invalidMinutes")}</p>}
          <details className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <summary className="cursor-pointer">{t("filterHelp")}</summary>
            <p>{t("quickFilterHint")}</p><p>{t("responseHint")}</p><p>{t("historyHint")}</p>
          </details>
          <p className="text-xs text-muted-foreground">{t("coverage", { since: connections.data?.observingSince ? new Date(connections.data.observingSince).toLocaleTimeString() : "—", sampled: sampledAt ? new Date(sampledAt).toLocaleTimeString() : "—" })}</p>
          {stale && !connections.isPending && <p role="status" className="text-sm text-destructive">{t("stale")}</p>}
          {connections.data?.truncated && <p role="status" className="text-sm text-destructive">{t("truncated")}</p>}
        </CardContent></Card>
        {connections.isPending ? <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label={t("loading")} /> : connections.isError ? errorView(() => void connections.refetch()) : <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{t("count", { count: connections.data?.total ?? 0 })}</span>
            <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 100))}>{t("previous")}</Button>
              <span>{t("page", { page: offset / 100 + 1 })}</span><Button size="sm" variant="outline" disabled={offset + 100 >= (connections.data?.total ?? 0)} onClick={() => setOffset(value => value + 100)}>{t("next")}</Button></div></div>
          {!connections.data?.connections.length ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</CardContent></Card> :
            <div className="space-y-3">{connections.data.connections.map(connection => {
              const responseStatus = getDiagnosticConnectionStatus(connection, sampledAt ?? null, connections.dataUpdatedAt);
              const selectableGroups = [...connection.chains].reverse().filter(name => proxyMap[name]?.type === "Selector" && proxyMap[name]?.all?.length);
              const leafName = connection.chains[0];
              const leafNodes = allNodes.filter(node => node.name === leafName);
              const leafNode = leafNodes.length === 1 ? leafNodes[0] : undefined;
              return <Card key={connection.id}>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><p className="break-all font-medium">{connection.host || connection.destinationIP || t("unknownHost")}{connection.destinationPort && <span className="text-muted-foreground">:{connection.destinationPort}</span>}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{connection.sourceIP}:{connection.sourcePort} · {connection.network.toUpperCase()} {connection.process && `· ${connection.process}`} {connection.host && connection.destinationIP && `· ${connection.destinationIP}`}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={responseStatus === "responded" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : responseStatus === "rejected" || responseStatus === "suspectedTimeout" || responseStatus === "noResponse" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" : undefined}>{t(`response.${responseStatus}`)}</Badge>
                    <Badge variant="outline">{t(stale ? "unknownState" : connection.active ? "active" : "ended")}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 text-sm"><span className="mr-1 text-xs text-muted-foreground">{t("route")}</span>
                  {connection.chains.length ? [...connection.chains].reverse().map((hop, index) => <span key={`${index}-${hop}`} className="inline-flex max-w-full items-center gap-1">
                    {index > 0 && <ArrowRight className="size-3 shrink-0 text-muted-foreground" />}
                    <Button variant="outline" size="sm" className="h-auto max-w-full whitespace-normal break-all py-1 text-xs" disabled={!proxyMap[hop]?.all} onClick={() => { setPolicyChoices([]); setFocusedGroup(hop); }}>{hop}</Button>
                  </span>) : <span className="text-muted-foreground">{t("noRoute")}</span>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1"><span className="break-all">{connection.rule}{connection.rulePayload && ` (${connection.rulePayload})`}</span>
                    <span>↑ {formatBytes(connection.upload)} · ↓ {formatBytes(connection.download)}</span>
                    <span>{t("lastSeen")}: {new Date(connection.lastSeen).toLocaleTimeString()}</span>
                    {connection.download === 0 && <Badge variant="outline">{t("noDownload")}</Badge>}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {leafNode && <Badge variant="outline">{t("nodeHealth")}: {latency(leafNode.id, leafNode)}</Badge>}
                    {leafNode && <Button size="sm" variant="ghost" disabled={!canControl || testing} onClick={() => health.mutate(leafNode.id)}><HeartPulse className="size-3" />{t("testNode")}</Button>}
                    {selectableGroups.length > 0 && <Button size="sm" variant="outline" disabled={!canControl} onClick={() => { setPolicyChoices(selectableGroups); setFocusedGroup(selectableGroups[0]); }}>{t("changeNode")}</Button>}
                    {connection.active && <Button size="sm" variant="ghost" disabled={!canControl || close.isPending || stale} onClick={() => close.mutate(connection.id)}><Unplug className="size-3" />{t("disconnect")}</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>; })}</div>}
        </>}
        {proxies.isError && errorView(() => void proxies.refetch())}
      </TabsContent>
      <TabsContent value="nodes" className="mt-5 space-y-5">
        <Card><CardHeader><CardTitle>{t("loadedConfig")}</CardTitle><CardDescription>{t("configHint")}</CardDescription></CardHeader><CardContent>
          <Button disabled={!canControl || testing} onClick={() => health.mutate(undefined)}><HeartPulse className="size-4" />{t(testing ? "testing" : "testAll")}</Button>
          {!!healthStatus.data?.startedAt && <p role="status" className="mt-3 text-sm">{testing
            ? t("healthProgress", { completed: healthStatus.data.results.length, total: healthStatus.data.total })
            : t("healthDone", { healthy: healthStatus.data.results.filter(result => result.delay !== null).length, total: healthStatus.data.total })}</p>}
          {healthStatus.isError && errorView(() => void healthStatus.refetch())}
          <p className="mt-3 text-xs text-muted-foreground">{t("testHint")}</p>
          {!canControl && !proxies.isPending && !proxies.isError && <p className="mt-2 text-sm text-muted-foreground">{t("readOnly")}</p>}
        </CardContent></Card>
        {proxies.isPending ? <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label={t("loading")} /> : proxies.isError ? errorView(() => void proxies.refetch()) : <>
          <h3 className="font-semibold">{t("groups")}</h3>
          {groups.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map(([name, proxy]) => <Card key={name}><CardHeader><CardTitle className="break-all text-base">{name}</CardTitle></CardHeader><CardContent>{groupEditor(name, proxy)}</CardContent></Card>)}</div> : <p className="text-sm text-muted-foreground">{t("noGroups")}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t("nodeCount", { count: nodes.length })}</h3>
            <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={nodeSearch} onChange={event => { setNodeSearch(event.target.value); setNodePage(0); }} placeholder={t("nodeSearch")} aria-label={t("nodeSearch")} /></div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{nodes.slice(nodePage * 60, nodePage * 60 + 60).map(node => <Card key={node.id}><CardContent className="space-y-3 py-4">
            <p className="break-all text-sm font-medium">{node.name}</p><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{node.type}</Badge><Badge variant="outline">{latency(node.id, node)}</Badge></div>
            {(node.provider || node['provider-name']) && <p className="break-all text-xs text-muted-foreground">{node.provider || node['provider-name']}</p>}
            <Button variant="outline" size="sm" disabled={!canControl || testing} onClick={() => health.mutate(node.id)}><HeartPulse className="size-3" />{t("testNode")}</Button>
          </CardContent></Card>)}</div>
          {!nodes.length && <p className="py-6 text-center text-sm text-muted-foreground">{t("noNodes")}</p>}
          {nodes.length > 60 && <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={nodePage === 0} onClick={() => setNodePage(page => page - 1)}>{t("previous")}</Button><Button variant="outline" size="sm" disabled={(nodePage + 1) * 60 >= nodes.length} onClick={() => setNodePage(page => page + 1)}>{t("next")}</Button></div>}
        </>}
      </TabsContent>
    </Tabs>}
    <Dialog open={focusedGroup !== null} onOpenChange={open => { if (!open) setFocusedGroup(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader>
      <DialogTitle className="break-all">{focusedGroup}</DialogTitle><DialogDescription>{t("switchHint")}</DialogDescription>
    </DialogHeader>
      {policyChoices.length > 1 && <Select value={focusedGroup ?? undefined} onValueChange={setFocusedGroup}>
        <SelectTrigger className="w-full" aria-label={t("routeGroup")}><SelectValue /></SelectTrigger>
        <SelectContent>{policyChoices.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
      </Select>}
      {focusedGroup && proxyMap[focusedGroup] && groupEditor(focusedGroup, proxyMap[focusedGroup])}
      {focusedGroup && proxyMap[focusedGroup]?.type === "Selector" && <div className="space-y-3">
        <p className="text-sm font-medium">{t("alternatives")}</p>
        <div className="grid gap-2 sm:grid-cols-2">{proxyMap[focusedGroup].all?.map(member => {
          const leaf = selectedLeaf(member, proxyMap);
          const matchingNodes = allNodes.filter(node => node.name === leaf);
          const node = matchingNodes.length === 1 ? matchingNodes[0] : undefined;
          const current = proxyMap[focusedGroup].now === member;
          return <div key={member} className="space-y-2 rounded-lg border p-3">
            <p className="break-all text-sm font-medium">{member}</p>
            {leaf && leaf !== member && <p className="break-all text-xs text-muted-foreground">{t("viaNode", { node: leaf })}</p>}
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{node ? latency(node.id, node) : t("untested")}</Badge>
              <Button size="sm" variant={current ? "secondary" : "outline"} disabled={!canControl || current || selection.isPending} onClick={() => selection.mutate({ group: focusedGroup, name: member })}>{t(current ? "selected" : "switchTo")}</Button>
              {node && <Button size="sm" variant="ghost" disabled={!canControl || testing} onClick={() => health.mutate(node.id)}>{t("testNode")}</Button>}
            </div>
          </div>;
        })}</div>
      </div>}
      <p className="flex gap-2 text-xs text-muted-foreground"><Check className="size-4 shrink-0" />{t("routeHint")}</p>
    </DialogContent></Dialog>
  </div>;
}
