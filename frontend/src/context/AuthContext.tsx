"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authAPI, tokenUtils } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const token = tokenUtils.get();
      if (token) {
        try {
          const userData = await authAPI.getProfile();
          setUser(userData);
        } catch {
          tokenUtils.remove();
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    setError("");
    await authAPI.login(email, password);
    const userData = await authAPI.getProfile();
    setUser(userData);
  };

  const register = async (name: string, email: string, password: string) => {
    setError("");
    await authAPI.register(name, email, password);
  };

  const logout = async () => {
    tokenUtils.remove();
    setUser(null);
  };

  const clearError = () => setError("");

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}