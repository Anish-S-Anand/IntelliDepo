"use client";

import { useCallback, useEffect, useState } from "react";

export interface ChatMessage {
  role: "user" | "agent" | "error";
  text?: string;
  markdown?: string;
  streaming?: boolean;
  meta?: {
    confidence?: number;
    publish_status?: string;
    query_type?: string;
    sources?: Array<{ name: string; category: string; detail: string }>;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "macropulse_chat_history";
const MAX_SESSIONS = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // storage full — remove oldest
    const trimmed = sessions.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser?.text) return "New chat";
  const text = firstUser.text;
  return text.length > 50 ? text.slice(0, 47) + "..." : text;
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions();
    setSessions(loaded);
  }, []);

  // Persist whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const createSession = useCallback((): string => {
    const newSession: ChatSession = {
      id: generateId(),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession.id;
  }, []);

  const updateSession = useCallback(
    (id: string, messages: ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                messages: messages.map((m) => ({ ...m, streaming: false })),
                title: deriveTitle(messages),
                updatedAt: Date.now(),
              }
            : s
        )
      );
    },
    []
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId]
  );

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    updateSession,
    deleteSession,
    selectSession,
    setActiveSessionId,
    clearAll,
  };
}
