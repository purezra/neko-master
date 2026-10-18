"use client";

import Image from "next/image";
import { ExternalLink, Info, RefreshCw, Star, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useVersionCheck } from "@/hooks/use-version-check";
import { GITHUB_REPO, GITHUB_URL, UPSTREAM_URL, LOGO_URL } from "@/lib/project-info";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("about");
  const { latestVersion, hasUpdate, isChecking, stars, noRelease, checkNow } = useVersionCheck(APP_VERSION);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[460px]" showCloseButton={false}>
      <Button variant="ghost" size="icon" aria-label={t("close")} onClick={() => onOpenChange(false)} className="absolute right-3 top-3"><X className="h-4 w-4" /></Button>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5" />{t("title")}</DialogTitle><DialogDescription>{t("forkDescription")}</DialogDescription></DialogHeader>
      <div className="flex items-center gap-4"><Image src={LOGO_URL} alt={t("projectName")} width={72} height={72} className="shrink-0" /><div><h3 className="text-xl font-bold">{t("projectName")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("description")}</p><p className="mt-1 text-xs font-medium text-primary">{GITHUB_REPO}</p></div></div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/50 p-3"><span>{t("currentVersion")}</span><span className="font-mono font-semibold text-primary">v{APP_VERSION}</span></div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/50 p-3"><span>{t("latestForkVersion")}</span><div className="text-right text-muted-foreground">
          {isChecking ? <span className="flex items-center gap-1 text-xs"><RefreshCw className="h-3 w-3 animate-spin" />{t("checkingUpdate")}</span>
            : noRelease ? <span className="text-xs">{t("noRelease")}</span>
            : latestVersion ? <a href={`${GITHUB_URL}/releases/latest`} target="_blank" rel="noopener noreferrer" className="text-xs hover:text-primary">v{latestVersion} · {hasUpdate ? t("updateAvailable") : t("upToDate")}</a>
            : <Button variant="ghost" size="sm" onClick={checkNow}>{t("checkNow")}</Button>}
        </div></div>
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-secondary/50 p-3"><span>{t("license")}</span><a href={`${GITHUB_URL}/blob/HEAD/LICENSE`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">MIT</a></div>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10"><div className="min-w-0"><p className="font-medium">{t("forkRepository")}</p><p className="truncate text-xs text-muted-foreground">{GITHUB_URL}</p></div><div className="flex shrink-0 items-center gap-2">{stars !== null && <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><Star className="h-3.5 w-3.5" />{stars}</span>}<ExternalLink className="h-4 w-4 text-muted-foreground" /></div></a>
        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3 text-muted-foreground hover:bg-secondary/50"><div><p className="text-xs font-medium">{t("upstream")}</p><p className="mt-0.5 text-xs">foru17/neko-master</p></div><ExternalLink className="h-4 w-4" /></a>
      </div>
    </DialogContent>
  </Dialog>;
}
