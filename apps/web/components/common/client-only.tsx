"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string; // Allow passing className to wrapper if needed (though we return children directly)
}

/**
 * A component that only renders its children on the client side.
 * This is useful for components that rely on browser-specific APIs (like window, localStorage)
 * or dynamic data that differs between server and client (like Date.now()),
 * which would otherwise cause HTML hydration mismatches.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isMounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!isMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
