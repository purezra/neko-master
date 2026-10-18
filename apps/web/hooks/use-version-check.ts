"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { GITHUB_REPO } from "@/lib/project-info";
const GITHUB_PACKAGE_URL =
  `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_API_URL =
  `https://api.github.com/repos/${GITHUB_REPO}`;
const CHECK_INTERVAL = 30 * 60 * 1000; // Check every 30 minutes
const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Compare two semver version strings.
 * Returns > 0 if remote is newer, 0 if equal, < 0 if current is newer.
 */
function compareVersions(current: string, remote: string): number {
  const a = current.replace(/^v/, "").split(".").map(Number);
  const b = remote.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] || 0) - (a[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface VersionCheckResult {
  /** The latest version from GitHub, null if not yet checked or failed */
  latestVersion: string | null;
  /** Whether a newer version is available */
  hasUpdate: boolean;
  /** Whether the check is currently in progress */
  isChecking: boolean;
  /** GitHub stars count, null if not yet fetched or failed */
  stars: number | null;
  noRelease: boolean;
  /** Manually trigger a version check */
  checkNow: () => void;
}

export function useVersionCheck(currentVersion: string): VersionCheckResult {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const [noRelease, setNoRelease] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    // Abort any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsChecking(true);
    try {
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      // Fetch version and stars in parallel
      const [pkgRes, repoRes] = await Promise.allSettled([
        fetch(GITHUB_PACKAGE_URL, {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch(GITHUB_API_URL, {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      // Don't update state if aborted (e.g. component unmounted)
      if (controller.signal.aborted) return;

      // Handle version check
      if (pkgRes.status === "fulfilled" && pkgRes.value.ok) {
        const pkg = await pkgRes.value.json();
        if (typeof pkg.tag_name === "string") {
          const version = pkg.tag_name.replace(/^v/, "");
          setLatestVersion(version);
          setNoRelease(false);
          setHasUpdate(compareVersions(currentVersion, version) > 0);
        }
      } else if (pkgRes.status === "fulfilled" && pkgRes.value.status === 404) {
        setNoRelease(true);
        setLatestVersion(null);
        setHasUpdate(false);
      }

      // Handle stars count
      if (repoRes.status === "fulfilled" && repoRes.value.ok) {
        const repo = await repoRes.value.json();
        if (typeof repo.stargazers_count === "number") {
          setStars(repo.stargazers_count);
        }
      }
    } catch {
      // Silently fail — network errors, timeouts, CORS issues, etc.
    } finally {
      if (abortRef.current === controller) {
        setIsChecking(false);
      }
    }
  }, [currentVersion]);

  useEffect(() => {
    // Initial check with a short delay to avoid blocking page load
    const initialTimer = setTimeout(check, 3000);

    // Periodic checks
    const interval = setInterval(check, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      // Abort any in-flight request on unmount
      abortRef.current?.abort();
    };
  }, [check]);

  return { latestVersion, hasUpdate, isChecking, stars, noRelease, checkNow: check };
}
