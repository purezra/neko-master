"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useMutation } from "@tanstack/react-query";

import type { AuthState } from "@neko-master/shared";

interface AuthContextType {
  isAuthenticated: boolean;
  authState: AuthState | null;
  isLoading: boolean;
  login: (token: string, updateState?: boolean) => Promise<boolean>;
  confirmLogin: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readAuthSession(): Promise<{ state: AuthState; authenticated: boolean }> {
  try {
    const response = await fetch("/api/auth/state");
    if (!response.ok) return { state: { enabled: false, hasToken: false }, authenticated: true };
    const state: AuthState = await response.json();
    const authenticated = !state.enabled || (await fetch("/api/backends")).ok;
    return { state, authenticated };
  } catch (error) {
    console.error("Failed to check auth state:", error);
    return { state: { enabled: false, hasToken: false }, authenticated: true };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // We use useLogout logic but inside provider
  const { mutate: logoutMutate } = useMutation({
    mutationFn: async () => {
       await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      setIsAuthenticated(false);
      window.location.reload();
    }
  });

  const applySession = useCallback((session: Awaited<ReturnType<typeof readAuthSession>>) => {
    setAuthState(session.state);
    setIsAuthenticated(session.authenticated);
    setIsLoading(false);
  }, []);
  const checkAuth = useCallback(async () => {
    applySession(await readAuthSession());
  }, [applySession]);

  // Confirm login manually (used for delayed UI transitions)
  const confirmLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  // Login with token
  const login = useCallback(
    async (token: string, updateState = true): Promise<boolean> => {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          return false;
        }

        const result = await response.json();
        if (result.valid) {
          if (updateState) {
            setIsAuthenticated(true);
          }
          return true;
        }

        return false;
      } catch (error) {
        console.error("Login failed:", error);
        return false;
      }
    },
    []
  );

  // Logout
  const logout = useCallback(() => {
    logoutMutate();
  }, [logoutMutate]);

  // Check auth on mount
  useEffect(() => {
    let cancelled = false;
    void readAuthSession().then(session => { if (!cancelled) applySession(session); });
    return () => { cancelled = true; };
  }, [applySession]);

  // Listen for unauthorized events from API (from custom fetch wrapper or axios)
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener("api:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("api:unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authState,
        isLoading,
        login,
        confirmLogin,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Hook to determine if login dialog should be shown
export function useRequireAuth() {
  const { authState, isAuthenticated, isLoading } = useAuth();
  
  // Logic: 
  // 1. If loading, don't show login yet (or show loading spinner)
  // 2. If auth not enabled, don't show login
  // 3. If auth enabled and not authenticated, show login
  
  const showLogin = !isLoading && !!authState?.enabled && !isAuthenticated;
  
  return {
    showLogin,
    isLoading,
    authEnabled: authState?.enabled,
    error: null, // We handle errors via event listeners mostly
  };
}
