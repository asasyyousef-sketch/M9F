import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AppUser } from "../types";

interface AuthContextType {
  currentUser: AppUser | null;
  token: string | null;
  hasAdmin: boolean | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setupAdmin: (username: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  refreshStatus: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "app_auth_token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to execute authenticated requests
  const authFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || {});
      const activeToken = token || localStorage.getItem(TOKEN_KEY);
      if (activeToken) {
        headers.set("Authorization", `Bearer ${activeToken}`);
      }
      return fetch(url, {
        ...init,
        headers,
      });
    },
    [token]
  );

  // Check auth and admin status on mount or when token changes
  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const activeToken = token || localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers["Authorization"] = `Bearer ${activeToken}`;
      }

      const res = await fetch("/api/auth/status", { headers });
      if (res.ok) {
        const data = await res.json();
        setHasAdmin(data.hasAdmin);
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
        } else {
          setCurrentUser(null);
          // If token was invalid on server, clear it
          if (activeToken) {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
          }
        }
      }
    } catch (err) {
      console.error("[Auth] Error checking auth status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Login handler
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "فشل تسجيل الدخول. يرجى التحقق من البيانات.";
        setError(msg);
        return { success: false, error: msg };
      }

      if (data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        // Clear active folder so any user always lands fresh on their root library
        localStorage.removeItem("active_folder_id");
        setToken(data.token);
        setCurrentUser(data.user);
        return { success: true };
      }
      return { success: false, error: "استجابة غير متوقعة من السيرفر." };
    } catch (err: any) {
      const msg = err.message || "خطأ في الاتصال بالسيرفر.";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Setup first admin account
  const setupAdmin = async (
    username: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setError(null);
      const res = await fetch("/api/auth/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "فشل إنشاء الحساب الرئيسي.";
        setError(msg);
        return { success: false, error: msg };
      }

      if (data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setHasAdmin(true);
        return { success: true };
      }
      return { success: false, error: "استجابة غير متوقعة من السيرفر." };
    } catch (err: any) {
      const msg = err.message || "خطأ في الاتصال بالسيرفر.";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      const activeToken = token || localStorage.getItem(TOKEN_KEY);
      if (activeToken) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      }
    } catch (e) {
      console.warn("[Auth] Error logging out:", e);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("cached_folders");
      localStorage.removeItem("cached_cards");
      localStorage.removeItem("active_folder_id");
      setToken(null);
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        hasAdmin,
        isLoading,
        error,
        login,
        logout,
        setupAdmin,
        refreshStatus,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
