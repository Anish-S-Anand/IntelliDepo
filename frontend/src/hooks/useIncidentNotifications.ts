"use client";

import { useEffect, useState, useCallback } from 'react';

interface AssignmentPopupData {
  incident_id: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  assigned_to: string;
  acknowledged_by: string;
  acknowledged_at: string;
  zone?: string;
  auto_dismiss_seconds: number;
}

interface WebSocketMessage {
  type: string;
  data?: AssignmentPopupData;
  client_id?: string;
  message?: string;
}

export function useIncidentNotifications() {
  const [popups, setPopups] = useState<AssignmentPopupData[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NEXT_PUBLIC_API_PORT || '8000';
    const wsUrl = `${protocol}//${host}:${port}/ws/notifications`;

    console.log('Connecting to WebSocket:', wsUrl);

    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);

        if (message.type === 'assignment_popup' && message.data) {
          // Add new popup to the list
          setPopups((prev) => [...prev, message.data!]);
        } else if (message.type === 'connection_established') {
          console.log('Connection established:', message.message);
        } else if (message.type === 'pong') {
          // Heartbeat response
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 5000);
    };

    setWs(websocket);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      websocket.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const removePopup = useCallback((incidentId: string) => {
    setPopups((prev) => prev.filter((p) => p.incident_id !== incidentId));
  }, []);

  return {
    popups,
    removePopup,
    isConnected,
  };
}
