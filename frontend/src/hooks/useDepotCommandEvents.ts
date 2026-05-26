"use client";

import { useEffect, useCallback } from "react";

export interface DepotCommandEvent {
  id: string;
  topic: string;
  event_type: string;
  payload: {
    action_type: string;
    message: string;
    target_name?: string;
    zone?: string;
    priority?: string;
    executed_at?: string;
    [key: string]: unknown;
  };
  sender?: string;
  timestamp: string;
}

type EventHandler = (event: DepotCommandEvent) => void;

/**
 * Subscribes to the depot.command SSE stream and calls the handler
 * whenever a command event arrives (broadcast, contact_operator, etc.)
 *
 * Uses SSE (Server-Sent Events) which works without WebSocket auth complexity.
 * Falls back silently if the backend is unavailable.
 */
export function useDepotCommandEvents(onEvent: EventHandler) {
  const stableHandler = useCallback(onEvent, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    const base = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : "http://localhost:8000";

    const url = `${base}/api/v1/realtime/stream/depot.command?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        es = new EventSource(url);

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as DepotCommandEvent;
            if (data.event_type && data.event_type !== "heartbeat") {
              stableHandler(data);
            }
          } catch {
            // ignore malformed events
          }
        };

        es.onerror = () => {
          es?.close();
          es = null;
          if (!cancelled) {
            retryTimer = setTimeout(connect, 5000);
          }
        };
      } catch {
        // SSE not supported or blocked — fail silently
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [stableHandler]);
}
