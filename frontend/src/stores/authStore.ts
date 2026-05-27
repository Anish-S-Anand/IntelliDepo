/**
 * Auth Store - user session, login/logout, token management
 */
import { create } from "zustand";
import api from "@/services/api";
import { DEMO_CREDENTIALS, getDemoCredential } from "@/lib/demoCredentials";

interface User {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  location?: string;
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

function enrichDemoRole<T extends User>(user: T): T {
  const demoCredential = DEMO_CREDENTIALS.find((credential) => credential.email.toLowerCase() === user.email.toLowerCase());
  if (!demoCredential) return user;
  return {
    ...user,
    role: demoCredential.role,
    location: demoCredential.location,
    is_superuser: demoCredential.role === "admin" || user.is_superuser,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  isAuthenticated: typeof window !== "undefined" ? !!localStorage.getItem("token") : false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const { data } = await api.post("/api/v1/auth/login", { email, password });

      localStorage.setItem("token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      set({
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      const { data: user } = await api.get("/api/v1/auth/me");
      set({ user: enrichDemoRole(user) });
    } catch (err: any) {
      console.warn("Backend login failed, trying local demo credentials");

      const demoCredential = getDemoCredential(email, password);
      if (demoCredential) {
        const demoToken = `demo-token-${demoCredential.id}`;
        localStorage.setItem("token", demoToken);

        set({
          token: demoToken,
          isAuthenticated: true,
          isLoading: false,
          user: {
            id: demoCredential.id,
            email: demoCredential.email,
            full_name: demoCredential.fullName,
            role: demoCredential.role,
            location: demoCredential.location,
            is_active: true,
            is_superuser: demoCredential.role === "admin",
            last_login: new Date().toISOString(),
          },
          error: null,
        });

        return;
      }

      const message = err.response?.data?.detail || "Invalid credentials. Use one of the demo role accounts.";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/api/v1/auth/register", {
        email,
        password,
        full_name: fullName,
      });
      set({ isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Registration failed";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/api/v1/auth/me");
      set({ user: enrichDemoRole(data), isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem("token");
    }
  },

  clearError: () => set({ error: null }),
}));
