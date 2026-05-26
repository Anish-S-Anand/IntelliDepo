"use client";

import { useState, useEffect } from "react";
import { Radio, X, AlertTriangle, Info, Zap } from "lucide-react";
import { useDepotCommandEvents, type DepotCommandEvent } from "@/hooks/useDepotCommandEvents";

interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  priority: string;
  sender?: string;
  timestamp: string;
}

function priorityStyle(priority: string) {
  switch (priority?.toUpperCase()) {
    case "P1": return { bg: "rgba(240,74,74,0.95)", border: "#F04A4A", icon: Zap, label: "CRITICAL" };
    case "P2": return { bg: "rgba(245,166,35,0.95)", border: "#F5A623", icon: AlertTriangle, label: "WARNING" };
    default:   return { bg: "rgba(91,155,245,0.95)", border: "#5B9BF5", icon: Info, label: "INFO" };
  }
}

export default function BroadcastBanner() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);

  useDepotCommandEvents((event: DepotCommandEvent) => {
    if (event.event_type === "depot.command.trigger_alert") {
      const msg: BroadcastMessage = {
        id: event.id,
        title: (event.payload.title as string) ?? "Broadcast Alert",
        message: event.payload.message,
        priority: event.payload.priority ?? "P2",
        sender: event.sender,
        timestamp: event.timestamp,
      };
      setMessages((prev) => [msg, ...prev].slice(0, 3)); // max 3 stacked
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }, 10000);
    }
  });

  if (messages.length === 0) return null;

  return (
    <div className="fixed top-[72px] left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-[520px] px-4">
      {messages.map((msg) => {
        const style = priorityStyle(msg.priority);
        const Icon = style.icon;
        return (
          <div
            key={msg.id}
            className="rounded-2xl shadow-2xl overflow-hidden animate-[slideDown_0.3s_ease]"
            style={{ background: style.bg, border: `1.5px solid ${style.border}` }}
          >
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 flex-shrink-0 mt-0.5">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Radio className="w-3 h-3 text-white/80 animate-pulse" />
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-wider">
                    Broadcast · {style.label}
                  </span>
                </div>
                <div className="text-[13px] font-extrabold text-white leading-tight">{msg.title}</div>
                <div className="text-[11px] text-white/90 mt-0.5 leading-snug">{msg.message}</div>
                {msg.sender && (
                  <div className="text-[9px] text-white/60 mt-1">Sent by {msg.sender}</div>
                )}
              </div>
              <button
                onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))}
                className="text-white/70 hover:text-white flex-shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Progress bar auto-dismiss */}
            <div className="h-1 bg-white/20">
              <div
                className="h-full bg-white/60 rounded-full"
                style={{ animation: "shrink 10s linear forwards" }}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
