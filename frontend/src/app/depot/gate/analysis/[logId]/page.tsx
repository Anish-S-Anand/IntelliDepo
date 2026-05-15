"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Clock, Car, DoorOpen, CheckCircle2, XCircle } from "lucide-react";
import { getAccessLogs, type AccessLogResponse } from "@/services/depotGate";

interface AnalysisPageProps {
  params: {
    logId: string;
  };
}

const DECISION_COLORS: Record<string, string> = {
  granted: "#22D3A1",
  denied: "#F04A4A",
  blacklisted: "#F04A4A",
  pending: "#F5A623",
};

function decisionColor(d: string): string {
  return DECISION_COLORS[d.toLowerCase()] || "#8A9BBF";
}

export default function AnalysisPage({ params }: AnalysisPageProps) {
  const router = useRouter();
  const { logId } = params;

  const [log, setLog] = useState<AccessLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLog = async () => {
      try {
        setLoading(true);
        setError(null);
        const logs = await getAccessLogs({ limit: 100 });
        const found = logs.find((l) => l.id === logId);
        if (found) {
          setLog(found);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Failed to load analysis log:", err);
        setError("Failed to load log data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (logId) {
      void loadLog();
    } else {
      setNotFound(true);
      setLoading(false);
    }
  }, [logId]);

  const handleBack = () => {
    router.push("/depot/gate");
  };

  if (loading) {
    return (
      <div className="p-5 bg-[#0D1526] min-h-screen flex items-center justify-center">
        <div className="text-[#4E6090] text-sm">Loading analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-[#0D1526] min-h-screen">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-[#8A9BBF] hover:text-[#E8EDF8] text-[12px] mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gate Console
        </button>
        <div className="rounded-[16px] border border-[#F04A4A]/30 bg-[#F04A4A]/08 p-6 text-center">
          <XCircle className="w-8 h-8 text-[#F04A4A] mx-auto mb-3" />
          <p className="text-[#F04A4A] text-[14px] font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg border border-[#F04A4A]/30 text-[#F04A4A] text-[12px] hover:bg-[#F04A4A]/10 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !log) {
    return (
      <div className="p-5 bg-[#0D1526] min-h-screen">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-[#8A9BBF] hover:text-[#E8EDF8] text-[12px] mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gate Console
        </button>
        <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-8 text-center">
          <XCircle className="w-10 h-10 text-[#4E6090] mx-auto mb-4" />
          <h2 className="text-[16px] font-bold text-[#E8EDF8] mb-2">Log Not Found</h2>
          <p className="text-[12px] text-[#8A9BBF]">
            No access log entry found for ID: <span className="font-mono text-[#E8EDF8]">{logId}</span>
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-5 px-4 py-2 rounded-lg bg-[#E5521A] text-white text-[12px] font-semibold hover:bg-[#E5521A]/90 transition-colors"
          >
            Back to Gate Console
          </button>
        </div>
      </div>
    );
  }

  const color = decisionColor(log.decision);

  return (
    <div className="p-5 bg-[#0D1526] min-h-screen animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-[#8A9BBF] hover:text-[#E8EDF8] text-[12px] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gate Console
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <Shield className="w-5 h-5 text-[#22D3A1]" />
        <h1
          className="text-[22px] font-extrabold text-[#E8EDF8]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          AI Analysis
        </h1>
        <span className="text-[11px] text-[#4E6090] ml-2">
          Log ID: <span className="font-mono">{log.id}</span>
        </span>
      </div>

      {/* Log Details Card */}
      <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-5 mb-4">
        <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] mb-4 flex items-center gap-2">
          <Car className="w-4 h-4" /> Access Log Details
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Plate Number</div>
            <div className="text-[16px] font-mono font-bold text-[#E8EDF8]">{log.plate_number}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Gate</div>
            <div className="text-[14px] font-mono text-[#E8EDF8]">{log.gate_code || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Decision</div>
            <span
              className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full"
              style={{
                color,
                background: `${color}15`,
                border: `1px solid ${color}30`,
              }}
            >
              {log.decision}
            </span>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Direction</div>
            <div className="flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-[#8A9BBF]" />
              <span className="text-[12px] text-[#E8EDF8] capitalize">{log.direction}</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Time</div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#8A9BBF]" />
              <span className="text-[11px] text-[#E8EDF8]">
                {new Date(log.processed_at || log.created_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Confidence</div>
            <div className="text-[12px] text-[#E8EDF8]">
              {log.plate_confidence != null ? `${(log.plate_confidence * 100).toFixed(1)}%` : "—"}
            </div>
          </div>
          {log.denied_reason && (
            <div className="col-span-2 md:col-span-3">
              <div className="text-[9px] uppercase tracking-wider text-[#4E6090] mb-1">Denial Reason</div>
              <div className="text-[12px] text-[#F04A4A]">{log.denied_reason}</div>
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis Placeholder */}
      <div className="rounded-[16px] border border-[#22D3A1]/20 bg-[#22D3A1]/04 p-5">
        <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#22D3A1] mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> AI Analysis Results
        </h2>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full border-2 border-[#22D3A1]/30 bg-[#22D3A1]/08 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-[#22D3A1]/50" />
          </div>
          <p className="text-[14px] font-semibold text-[#8A9BBF] mb-2">Analysis Pending</p>
          <p className="text-[11px] text-[#4E6090] max-w-sm mx-auto">
            AI analysis capabilities are coming soon. This page will display detailed risk assessment,
            anomaly detection, and recommendations for this access event.
          </p>
        </div>
      </div>
    </div>
  );
}
