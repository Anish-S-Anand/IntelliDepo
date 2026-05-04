"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Send,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { useMacroPulseTenant } from "@/hooks/useMacroPulseTenant";
import { useChatHistory } from "@/hooks/useChatHistory";
import type { ChatMessage, ChatSession } from "@/hooks/useChatHistory";
import { getAgentMetrics, streamMacroPulseAgent } from "@/services/macropulse";
import type { AgentMetrics } from "@/types/macropulse";
import ChatHistorySidebar from "@/components/stream/macropulse/ChatHistorySidebar";

/* ── Suggested prompts ──────────────────────────────────────── */
const SUGGESTED_PROMPTS = [
  { icon: TrendingUp, label: "FX Risk on USD exposure", text: "What's the current FX risk for our USD exposure and recommended hedging action?" },
  { icon: Zap, label: "Repo rate impact on loans", text: "Summarize the repo rate impact on our floating rate loan book and expected EMI change." },
  { icon: Sparkles, label: "Crude oil COGS effect", text: "How will a $20 spike in Brent crude oil affect our COGS and quarterly margins?" },
  { icon: TrendingUp, label: "WPI inflation outlook", text: "What's the WPI inflation outlook for Q4 and how should we adjust procurement pricing?" },
  { icon: Zap, label: "Fed rate hike scenario", text: "Run a worst-case scenario: Fed rate hike of +100bps. What's the P&L impact?" },
  { icon: Sparkles, label: "India macro posture", text: "What's the current regional macro posture for India — RBI stance, FX trend, and commodity signal?" },
  { icon: TrendingUp, label: "Combined macro impact Q4", text: "Analyze combined macro impact on Q4 margins across interest rate, FX, and crude oil variables." },
  { icon: Zap, label: "CFO brief summary", text: "Generate a CFO-ready brief summarizing the top 3 macro risks for this week." },
];

const REGION_MAP: Record<string, "India" | "UAE" | "Saudi Arabia"> = {
  IN: "India",
  UAE: "UAE",
  SA: "Saudi Arabia",
};

/* ── Meta type ──────────────────────────────────────────────── */
interface AgentMeta {
  confidence?: number;
  publish_status?: string;
  query_type?: string;
  sources?: Array<{ name: string; category: string; detail: string }>;
}

/* ── Confidence & Status badges ─────────────────────────────── */
function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value);
  const color =
    pct >= 85
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : pct >= 70
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${color}`}>
      {pct}% confidence
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    publish: "bg-emerald-50 text-emerald-700 border-emerald-200",
    review: "bg-blue-50 text-blue-700 border-blue-200",
    hitl_queue: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const labels: Record<string, string> = {
    publish: "Auto-Published",
    review: "Needs Review",
    hitl_queue: "HITL Queue",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${styles[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {labels[status] ?? status}
    </span>
  );
}

/* ── Copy button ────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
      title="Copy response"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
    </button>
  );
}

/* ── Sources panel ──────────────────────────────────────────── */
function SourcesPanel({ sources }: { sources: AgentMeta["sources"] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {sources.length} source{sources.length !== 1 ? "s" : ""} cited
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {sources.map((src, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
              <span
                className={`mt-1 shrink-0 rounded-full w-1.5 h-1.5 ${
                  src.category === "official" ? "bg-blue-500" :
                  src.category === "market" ? "bg-emerald-500" :
                  src.category === "news" ? "bg-amber-500" : "bg-purple-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-700">{src.name}</p>
                <p className="text-[11px] text-gray-500">{src.detail}</p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${
                  src.category === "official" ? "bg-blue-50 text-blue-600" :
                  src.category === "market" ? "bg-emerald-50 text-emerald-600" :
                  src.category === "news" ? "bg-amber-50 text-amber-600" : "bg-purple-50 text-purple-600"
                }`}
              >
                {src.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Agent message bubble ───────────────────────────────────── */
function AgentBubble({ message }: { message: ChatMessage }) {
  if (message.role !== "agent") return null;
  return (
    <div className="group flex gap-3 max-w-full">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm mt-0.5">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm prose-gray max-w-none [&_table]:text-sm [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_table]:border [&_th]:border [&_td]:border [&_blockquote]:border-l-blue-500 [&_blockquote]:bg-blue-50/50 [&_blockquote]:py-1 [&_blockquote]:text-blue-800 [&_h2]:text-base [&_h2]:mt-0 [&_h3]:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.markdown ?? ""}</ReactMarkdown>
          {message.streaming && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
          )}
        </div>

        {message.meta && !message.streaming && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {message.meta.confidence != null && <ConfidenceBadge value={message.meta.confidence} />}
            {message.meta.publish_status && <StatusBadge status={message.meta.publish_status} />}
            {message.meta.query_type && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 capitalize">
                {message.meta.query_type.replace(/_/g, " ")}
              </span>
            )}
            <CopyButton text={message.markdown ?? ""} />
          </div>
        )}

        {message.meta?.sources && !message.streaming && <SourcesPanel sources={message.meta.sources} />}
      </div>
    </div>
  );
}

/* ── Typing indicator ───────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-xs text-gray-500 ml-2">Analyzing macro signals...</span>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function MacroPulseAgentPage() {
  const { tenantId, ready } = useMacroPulseTenant();
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    sessions,
    activeSessionId,
    createSession,
    updateSession,
    deleteSession,
    selectSession,
    setActiveSessionId,
    clearAll,
  } = useChatHistory();

  useEffect(() => {
    getAgentMetrics().then(setMetrics).catch(() => null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When active session changes, load its messages (but not while streaming)
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Only reload messages when the user actually switches sessions
    if (activeSessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = activeSessionId;

    if (activeSessionId) {
      const session = sessions.find((s) => s.id === activeSessionId);
      if (session) {
        setMessages(session.messages);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId, sessions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !ready) return;
      const userMsg = text.trim();
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      // Create session if none active
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = createSession();
      }

      // Add user message
      const newMessages: ChatMessage[] = [...messages, { role: "user", text: userMsg }];
      setMessages(newMessages);
      setIsStreaming(true);

      // Add placeholder agent message
      const withAgent: ChatMessage[] = [...newMessages, { role: "agent", markdown: "", streaming: true }];
      setMessages(withAgent);

      const region = REGION_MAP["IN"] ?? "India";
      let streamedMarkdown = "";

      await streamMacroPulseAgent(
        userMsg,
        tenantId,
        region,
        // onToken
        (token) => {
          streamedMarkdown += token;
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "agent") {
              updated[updated.length - 1] = { ...last, markdown: streamedMarkdown };
            }
            return updated;
          });
        },
        // onMeta
        (meta) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "agent") {
              updated[updated.length - 1] = {
                ...last,
                meta: {
                  confidence: meta.confidence as number,
                  publish_status: meta.publish_status as string,
                  query_type: meta.query_type as string,
                  sources: meta.sources as AgentMeta["sources"],
                },
              };
            }
            return updated;
          });
        },
        // onDone
        () => {
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "agent") {
              updated[updated.length - 1] = { ...last, streaming: false };
            }
            // Save to history
            if (sessionId) {
              updateSession(sessionId, updated);
            }
            return updated;
          });
          setIsStreaming(false);
        },
        // onError
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.role === "agent" && !updated[updated.length - 1].markdown) {
              updated.pop();
            }
            const final = [...updated, { role: "error" as const, text: "MacroPulse Agent is unavailable. Please check your backend connection." }];
            if (sessionId) updateSession(sessionId, final);
            return final;
          });
          setIsStreaming(false);
        }
      );
    },
    [isStreaming, ready, tenantId, messages, activeSessionId, createSession, updateSession]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleSelectSession = (id: string) => {
    selectSession(id);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Chat history sidebar */}
      <ChatHistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        onDelete={deleteSession}
        onClearAll={clearAll}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <div className="shrink-0 px-8 pt-5 pb-3 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">MacroPulse Agent</h2>
              <p className="text-xs text-gray-500">AI-powered macroeconomic intelligence</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
            </span>
          </div>

          {/* Compact metrics */}
          {metrics && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label: "Requests", value: String(metrics.total_requests ?? "--") },
                { label: "p50", value: metrics.p50_ms != null ? `${metrics.p50_ms.toFixed(0)}ms` : "--" },
                { label: "p95", value: metrics.p95_ms != null ? `${metrics.p95_ms.toFixed(0)}ms` : "--" },
                { label: "Confidence", value: metrics.avg_confidence != null ? `${metrics.avg_confidence.toFixed(0)}%` : "--" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{m.label}</p>
                  <p className="text-sm font-black text-gray-900">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/25 mb-6">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">How can I help you today?</h3>
              <p className="text-sm text-gray-500 mb-8 text-center">
                Ask me about macro conditions, FX risk, interest rates, commodity prices, or run financial simulations.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => void sendMessage(p.text)}
                    disabled={isStreaming}
                    className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all disabled:opacity-50"
                  >
                    <p.icon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition leading-snug">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m, i) => (
                <div key={i}>
                  {m.role === "user" ? (
                    <div className="flex gap-3 justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-[#1a2332] text-white px-4 py-3 text-sm leading-6">
                        {m.text}
                      </div>
                    </div>
                  ) : m.role === "error" ? (
                    <div className="flex gap-3">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="max-w-[75%] rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <AgentBubble message={m} />
                  )}
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "agent" && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-sm px-8 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKey}
                rows={1}
                placeholder="Ask MacroPulse Agent about macro conditions, risk, FX, or simulations..."
                className="flex-1 text-sm resize-none focus:outline-none min-h-[24px] max-h-[160px] leading-6 placeholder:text-gray-400"
              />
              <button
                onClick={() => void sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center hover:from-cyan-600 hover:to-blue-700 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              MacroPulse Agent uses deterministic financial models. Responses are auto-verified with confidence scoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
