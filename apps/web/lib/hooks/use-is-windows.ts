"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => window.navigator.userAgent.toLowerCase().includes("windows");
const getServerSnapshot = () => false;

export function useIsWindows(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
