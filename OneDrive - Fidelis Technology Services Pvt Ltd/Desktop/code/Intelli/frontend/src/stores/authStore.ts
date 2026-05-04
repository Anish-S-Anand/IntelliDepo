/**
 * Auth Store — user session, login/logout, token management
 */
import { create } from "zustand";
import api from "@/services/api";

interface User {
  id: string;
  email: string;
  full_name: string;
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
      set({ token: data.access_token, isAuthenticated: true, isLoading: false });
      // Fetch user profile after login
      const { data: user } = await api.get("/api/v1/auth/me");
      set({ user });
    } catch (err: any) {
      const message = err.response?.data?.detail || "Login failed";
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
      set({ user: data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
      localStorage.removeItem("token");
    }
  },

  clearError: () => set({ error: null }),
}));
