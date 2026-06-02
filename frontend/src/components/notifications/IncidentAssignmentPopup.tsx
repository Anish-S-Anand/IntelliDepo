"use client";

import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

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

interface IncidentAssignmentPopupProps {
  data: AssignmentPopupData;
  onClose: () => void;
}

const priorityColors = {
  P1: 'bg-red-500 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-yellow-500 text-black',
  P4: 'bg-green-500 text-white',
};

const priorityLabels = {
  P1: 'Critical - Immediate Response',
  P2: 'High - 15 min SLA',
  P3: 'Medium - 1 hour SLA',
  P4: 'Low - 4 hour SLA',
};

export function IncidentAssignmentPopup({ data, onClose }: IncidentAssignmentPopupProps) {
  const [timeLeft, setTimeLeft] = useState(data.auto_dismiss_seconds);

  useEffect(() => {
    // Auto-dismiss countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-200 dark:border-gray-700 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-t-lg">
        <div className="flex items-center gap-2 text-white">
          <AlertCircle className="w-6 h-6" />
          <h3 className="font-bold text-lg">Incident Acknowledged</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Incident</p>
          <p className="font-semibold text-gray-900 dark:text-white">{data.title}</p>
        </div>

        {/* Priority with SLA */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Priority / SLA</p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${priorityColors[data.priority]}`}>
            {data.priority} - {priorityLabels[data.priority]}
          </span>
        </div>

        {/* Assigned To */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Assigned To</p>
          <p className="font-medium text-gray-900 dark:text-white">{data.assigned_to}</p>
        </div>

        {/* Acknowledged By */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Acknowledged By</p>
          <p className="font-medium text-gray-900 dark:text-white">{data.acknowledged_by}</p>
        </div>

        {/* Time */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Acknowledged At</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{formatDate(data.acknowledged_at)}</p>
        </div>

        {/* Zone (if available) */}
        {data.zone && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Zone</p>
            <p className="font-medium text-gray-900 dark:text-white">{data.zone}</p>
          </div>
        )}

        {/* Auto-dismiss timer */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Auto-closing in {timeLeft} seconds
          </p>
          <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / data.auto_dismiss_seconds) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
