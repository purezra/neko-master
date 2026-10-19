"use client";

import { useState } from "react";
import { ChevronDown, ListFilter, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PolicyGroupFilterProps {
  groups: string[];
  selectedGroups: string[];
  onChange: (groups: string[]) => void;
  portalContainer?: HTMLElement | null;
}

export function PolicyGroupFilter({ groups, selectedGroups, onChange, portalContainer }: PolicyGroupFilterProps) {
  const t = useTranslations("rules");
  const [search, setSearch] = useState("");
  const selected = new Set(selectedGroups);
  const matches = groups.filter(name => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return (
    <Popover onOpenChange={open => { if (!open) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 rounded-full px-3 text-xs bg-background/85 backdrop-blur",
            selected.size > 0 && "border-primary text-primary",
          )}>
          <ListFilter className="h-3.5 w-3.5" />
          {selected.size > 0 ? t("policyGroupsSelected", { count: selected.size }) : t("policyGroups")}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent container={portalContainer} align="end" className="w-[34rem] max-w-[calc(100vw-2rem)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t("policyGroups")}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={selected.size === 0} onClick={() => onChange([])}>
            {t("resetPolicyGroups")}
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t("policyGroupsHint")}</p>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("searchPolicyGroups")} aria-label={t("searchPolicyGroups")} className="h-9 pl-9" />
        </div>
        <div className="grid max-h-80 grid-cols-2 gap-x-2 overflow-y-auto overscroll-contain" role="group" aria-label={t("policyGroups")}>
          {matches.length === 0 ? (
            <p className="col-span-2 py-5 text-center text-xs text-muted-foreground">{t("noMatchingPolicyGroups")}</p>
          ) : matches.map(name => (
            <label key={name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
              <input
                type="checkbox"
                checked={selected.has(name)}
                onChange={event => onChange(event.target.checked ? [...selectedGroups, name] : selectedGroups.filter(group => group !== name))}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 break-words">{name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
