"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  X,
} from "lucide-react";
import type { ChatSession } from "@/hooks/useChatHistory";

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function groupSessions(sessions: ChatSession[]) {
  const now = Date.now();
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const thisWeek: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const s of sessions) {
    const diff = now - s.updatedAt;
    const days = diff / 86400000;
    if (days < 1) today.push(s);
    else if (days < 2) yesterday.push(s);
    else if (days < 7) thisWeek.push(s);
    else older.push(s);
  }

  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "This week", items: thisWeek },
    { label: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function ChatHistorySidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  collapsed,
  onToggle,
}: ChatHistorySidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const groups = groupSessions(sessions);

  if (collapsed) {
    return (
      <div className="shrink-0 w-12 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-3 gap-3">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-200 transition text-gray-500"
          title="Open chat history"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onNew}
          className="p-2 rounded-lg hover:bg-gray-200 transition text-gray-500"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Chat History</span>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-400"
          title="Close sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3 pb-2">
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No conversations yet</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mt-3 first:mt-0">
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>
              {group.items.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelect(session.id)}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-left transition-all ${
                    activeSessionId === session.id
                      ? "bg-blue-50 border border-blue-200 text-blue-900"
                      : "hover:bg-gray-100 text-gray-700 border border-transparent"
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${
                    activeSessionId === session.id ? "text-blue-500" : "text-gray-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{session.title}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimeAgo(session.updatedAt)}
                      <span className="ml-auto">{session.messages.filter((m) => m.role === "user").length} msgs</span>
                    </p>
                  </div>
                  {hoveredId === session.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(session.id);
                      }}
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Clear all */}
      {sessions.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-200">
          {confirmClear ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-600 font-medium">Delete all?</span>
              <button
                onClick={() => { onClearAll(); setConfirmClear(false); }}
                className="px-2 py-1 bg-red-500 text-white rounded text-[11px] font-medium hover:bg-red-600"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[11px] font-medium hover:bg-gray-300"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-red-500 transition"
            >
              <Trash2 className="w-3 h-3" />
              Clear all conversations
            </button>
          )}
        </div>
      )}
    </div>
  );
}
