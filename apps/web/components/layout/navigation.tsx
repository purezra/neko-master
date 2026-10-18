"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { LOGO_URL } from "@/lib/project-info";
import {
  LayoutDashboard,
  GitCompareArrows,
  Globe,
  MapPin,
  Server,
  Route,
  Download,
  Settings,
  Info,
  Smartphone,
  ShieldAlert,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AboutDialog } from "@/components/common/about-dialog";
import { BackendConfigDialog } from "@/components/features/backend";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVersionCheck } from "@/hooks/use-version-check";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAuthState } from "@/lib/auth-queries"; // Added

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBackendChange?: () => void;
  backendStatus?: "healthy" | "unhealthy" | "unknown";
}

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

const NAV_ITEMS = [
  { id: "overview", icon: LayoutDashboard },
  { id: "comparison", icon: GitCompareArrows },
  { id: "rules", icon: Route },
  { id: "domains", icon: Globe },
  { id: "countries", icon: MapPin },
  { id: "proxies", icon: Server },
  { id: "devices", icon: Smartphone },
  { id: "export", icon: Download },
  { id: "health", icon: HeartPulse },
];

export function Navigation({
  activeTab,
  onTabChange,
  onBackendChange,
  backendStatus = "unknown",
}: NavigationProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const t = useTranslations("nav");

  const { data: authState } = useAuthState(); // Added
  const isShowcase = authState?.showcaseMode ?? false; // Added

  const headerT = useTranslations("header");
  const backendT = useTranslations("backend");
  const aboutT = useTranslations("about");
  const dashboardT = useTranslations("dashboard");
  const { hasUpdate } =
    useVersionCheck(APP_VERSION);
  const { canInstall, promptInstall } = usePWAInstall();
  const pwaT = useTranslations("pwa");

  const statusClass =
    backendStatus === "healthy"
      ? "bg-emerald-500"
      : backendStatus === "unhealthy"
        ? "bg-rose-500"
        : "bg-amber-500";

  const statusPingClass =
    backendStatus === "healthy"
      ? "bg-emerald-400/70"
      : backendStatus === "unhealthy"
        ? "bg-rose-400/70"
        : "bg-amber-400/70";

  const statusText =
    backendStatus === "healthy"
      ? dashboardT("backendHealthy")
      : backendStatus === "unhealthy"
        ? dashboardT("backendUnavailable")
        : dashboardT("backendStatusUnknown");
  const isBackendUnhealthy = backendStatus === "unhealthy";
  const statusDotSizeClass = isBackendUnhealthy ? "h-3 w-3" : "h-2.5 w-2.5";
  const statusPingAnimationClass = isBackendUnhealthy
    ? "animate-ping [animation-duration:700ms]"
    : "animate-ping [animation-duration:2s]";

  return (
    <>
      {/* Desktop Navigation - Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-border/40 bg-background/80 backdrop-blur-md">
        {/* Logo */}
        <div className="flex items-start gap-3 p-6 border-b border-border/40">
          <div className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center overflow-hidden hover:opacity-80">
            <Image
              src={LOGO_URL}
              alt="Neko Master"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl leading-tight whitespace-nowrap">
                {headerT("title")}
              </h1>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "relative inline-flex shrink-0",
                        statusDotSizeClass,
                      )}
                      aria-label={statusText}
                      role="status">
                      <span
                        className={cn(
                          "absolute inline-flex h-full w-full rounded-full",
                          statusPingClass,
                          statusPingAnimationClass,
                        )}
                      />
                      {isBackendUnhealthy && (
                        <span
                          className={cn(
                            "absolute inline-flex h-full w-full rounded-full animate-ping [animation-duration:700ms] [animation-delay:140ms]",
                            statusPingClass,
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative inline-flex rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.06)]",
                          statusClass,
                          statusDotSizeClass,
                        )}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{statusText}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs leading-4 text-muted-foreground/60 min-h-8 mt-0.5">
              {headerT("subtitle")}
            </p>
          </div>
        </div>

        {/* Showcase Mode Indicator */}
        {isShowcase && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/15">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {t("showcaseMode")}
              </span>
            </div>
          </div>
        )}

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}>
                <Icon className="w-5 h-5" />
                {t(item.id)}
              </button>
            );
          })}
        </nav>

        {/* PWA Install Prompt */}
        {canInstall && (
          <div className="px-4 pb-3">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={promptInstall}
                    className="group w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-primary/8 to-primary/4 hover:from-primary/14 hover:to-primary/8 border border-primary/15 hover:border-primary/30">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="text-primary">
                        <path
                          d="M8 1.5v8m0 0L5 6.5m3 3 3-3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-primary/90">
                      {pwaT("installApp")}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px]">
                  <p className="text-xs">{pwaT("tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border/40 space-y-1">
          <button
            onClick={() => setAboutOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative",
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}>
            <Info className="w-5 h-5" />
            {aboutT("title")}
            {hasUpdate && (
              <span className="ml-auto flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                {aboutT("newVersion")}
              </span>
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}>
            <Settings className="w-5 h-5" />
            {backendT("title")}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-md">
        <div className="h-16 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center h-full min-w-full px-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "min-w-[20%] shrink-0 flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition-all",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{t(item.id)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Settings Dialog */}
      <BackendConfigDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isFirstTime={false}
        onBackendChange={onBackendChange}
      />

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
