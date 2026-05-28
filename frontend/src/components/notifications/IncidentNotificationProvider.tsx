"use client";

import React from 'react';
import { useIncidentNotifications } from '@/hooks/useIncidentNotifications';
import { IncidentAssignmentPopup } from './IncidentAssignmentPopup';

export function IncidentNotificationProvider({ children }: { children: React.ReactNode }) {
  const { popups, removePopup, isConnected } = useIncidentNotifications();

  return (
    <>
      {children}
      
      {/* Render all active popups */}
      <div className="fixed top-4 right-4 z-50 space-y-4">
        {popups.map((popup, index) => (
          <div key={popup.incident_id} style={{ marginTop: `${index * 10}px` }}>
            <IncidentAssignmentPopup
              data={popup}
              onClose={() => removePopup(popup.incident_id)}
            />
          </div>
        ))}
      </div>

      {/* Connection status indicator (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      )}
    </>
  );
}
