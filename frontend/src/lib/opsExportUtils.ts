/**
 * IntelliOps™ — Export Utilities for Ops Reports (Day 5)
 *
 * Export functions for SLA scorecards (CSV), incident reports (PDF),
 * and escalation audit trails (PDF).
 * Reuses the shared downloadCsv / downloadPdf from exportUtils.
 */

import { downloadCsv, downloadPdf } from "./exportUtils";

// ---------------------------------------------------------------------------
// SLA Scorecard CSV Export
// ---------------------------------------------------------------------------

export function exportScorecardCsv(
  scorecards: {
    group_name: string;
    total_slas: number;
    compliant: number;
    at_risk: number;
    breached: number;
    compliance_pct: number;
    penalty_amount: number;
  }[],
) {
  downloadCsv(
    `sla-scorecard-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Module/Group", "Total SLAs", "Compliant", "At Risk", "Breached", "Compliance %", "Penalty ($)"],
    scorecards.map((r) => [
      r.group_name,
      r.total_slas,
      r.compliant,
      r.at_risk,
      r.breached,
      `${r.compliance_pct}%`,
      r.penalty_amount,
    ]),
  );
}

// ---------------------------------------------------------------------------
// Incident Report PDF Export
// ---------------------------------------------------------------------------

export function exportOpsIncidentReport(
  incidents: {
    id: string;
    title: string;
    priority: string;
    status: string;
    source: string;
    zone: string | null;
    assigned_to: string | null;
    escalation_level: number;
    created_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
  }[],
) {
  const open = incidents.filter((i) => i.status === "open").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const p1Count = incidents.filter((i) => i.priority === "P1").length;
  const escalated = incidents.filter((i) => i.status === "escalated").length;

  downloadPdf(
    "IntelliOps Incident Report",
    `${incidents.length} incidents · ${new Date().toLocaleDateString()}`,
    [
      {
        title: "Summary",
        summary: [
          { label: "Total Incidents", value: String(incidents.length) },
          { label: "Open", value: String(open) },
          { label: "Escalated", value: String(escalated) },
          { label: "Resolved", value: String(resolved) },
          { label: "P1 Critical", value: String(p1Count) },
        ],
      },
      {
        title: "Incident Details",
        table: {
          headers: ["ID", "Title", "Priority", "Status", "Source", "Zone", "Assigned To", "Escalation", "Created", "Resolved"],
          rows: incidents.map((i) => [
            i.id.slice(0, 8),
            i.title,
            i.priority,
            i.status.toUpperCase(),
            i.source,
            i.zone || "—",
            i.assigned_to || "—",
            `Tier ${i.escalation_level}`,
            new Date(i.created_at).toLocaleString(),
            i.resolved_at ? new Date(i.resolved_at).toLocaleString() : "—",
          ]),
        },
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Escalation Audit Trail PDF Export
// ---------------------------------------------------------------------------

export function exportAuditTrailPdf(
  incidentTitle: string,
  entries: {
    action: string;
    actor: string | null;
    actor_role: string | null;
    previous_state: string | null;
    new_state: string | null;
    details: string | null;
    created_at: string;
  }[],
) {
  downloadPdf(
    `Audit Trail — ${incidentTitle}`,
    `${entries.length} entries · ${new Date().toLocaleDateString()}`,
    [
      {
        title: "Audit Timeline",
        table: {
          headers: ["Time", "Action", "Actor", "Role", "From", "To", "Details"],
          rows: entries.map((e) => [
            new Date(e.created_at).toLocaleString(),
            e.action.replace(/_/g, " "),
            e.actor || "system",
            e.actor_role || "—",
            e.previous_state || "—",
            e.new_state || "—",
            e.details || "—",
          ]),
        },
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Penalty Report CSV Export
// ---------------------------------------------------------------------------

export function exportPenaltyCsv(
  penalties: {
    sla_name: string | null;
    client_name: string | null;
    breach_started_at: string;
    breach_ended_at: string | null;
    breach_duration_minutes: number;
    penalty_rate_per_hour: number;
    penalty_amount: number;
    status: string;
  }[],
) {
  const total = penalties.reduce((s, p) => s + p.penalty_amount, 0);

  downloadCsv(
    `penalty-report-${new Date().toISOString().slice(0, 10)}.csv`,
    ["SLA Name", "Client", "Breach Start", "Breach End", "Duration (min)", "Rate ($/hr)", "Penalty ($)", "Status"],
    [
      ...penalties.map((p) => [
        p.sla_name || "—",
        p.client_name || "—",
        new Date(p.breach_started_at).toLocaleString(),
        p.breach_ended_at ? new Date(p.breach_ended_at).toLocaleString() : "Ongoing",
        Math.round(p.breach_duration_minutes),
        p.penalty_rate_per_hour,
        p.penalty_amount,
        p.status,
      ]),
      ["", "", "", "", "", "TOTAL", total.toFixed(2), ""],
    ],
  );
}
