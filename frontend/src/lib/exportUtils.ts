/**
 * Export Utilities — CSV & PDF generation for IntelliVision reports.
 *
 * CSV: Blob-based browser download.
 * PDF: HTML-to-print using a hidden iframe with styled content.
 */

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// PDF Export (HTML-to-Print)
// ---------------------------------------------------------------------------

interface PdfSection {
  title: string;
  table?: { headers: string[]; rows: (string | number)[][] };
  summary?: { label: string; value: string }[];
  text?: string;
}

export function downloadPdf(
  title: string,
  subtitle: string,
  sections: PdfSection[],
) {
  const now = new Date().toLocaleString();

  const sectionHtml = sections
    .map((s) => {
      let content = "";

      if (s.summary) {
        content += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
          ${s.summary
            .map(
              (kv) =>
                `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#1e293b">${kv.value}</div>
                  <div style="font-size:11px;color:#64748b;margin-top:4px">${kv.label}</div>
                </div>`,
            )
            .join("")}
        </div>`;
      }

      if (s.text) {
        content += `<p style="color:#475569;font-size:13px;line-height:1.6;margin-bottom:16px">${s.text}</p>`;
      }

      if (s.table) {
        content += `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <thead>
            <tr>${s.table.headers
              .map(
                (h) =>
                  `<th style="text-align:left;padding:8px 10px;background:#f1f5f9;border-bottom:2px solid #e2e8f0;color:#334155;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${h}</th>`,
              )
              .join("")}</tr>
          </thead>
          <tbody>
            ${s.table.rows
              .map(
                (row, i) =>
                  `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">${row
                    .map(
                      (cell) =>
                        `<td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#475569">${cell}</td>`,
                    )
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>`;
      }

      return `<div style="margin-bottom:24px">
        <h2 style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5521a">${s.title}</h2>
        ${content}
      </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print { body { margin: 0; } }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 32px; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #e5521a">
    <div>
      <div style="font-size:10px;font-weight:700;color:#e5521a;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Fidelis IntelliDepot</div>
      <h1 style="font-size:24px;font-weight:700;margin:0 0 4px 0;color:#0f172a">${title}</h1>
      <p style="font-size:12px;color:#64748b;margin:0">${subtitle}</p>
    </div>
    <div style="text-align:right;font-size:11px;color:#94a3b8">
      <div>Generated: ${now}</div>
      <div>IntelliVision Report</div>
    </div>
  </div>
  ${sectionHtml}
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between">
    <span>Fidelis IntelliDepot™ v2.4.1</span>
    <span>Confidential — Internal Use Only</span>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      URL.revokeObjectURL(url);
    };
  } else {
    // Fallback: download as HTML
    triggerDownload(blob, title.replace(/\s+/g, "_") + ".html");
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Pre-built report generators
// ---------------------------------------------------------------------------

export function exportCountingReport(sessions: {
  manifestCode: string;
  vehicleNumber: string;
  zone: string;
  camera: string;
  expectedBags: number;
  expectedBoxes: number;
  countedBags: number;
  countedBoxes: number;
  totalExpected: number;
  totalCounted: number;
  discrepancy: number;
  confidenceAvg: number;
  status: string;
  timestamp: string;
}[]) {
  const totalExpected = sessions.reduce((s, r) => s + r.totalExpected, 0);
  const totalCounted = sessions.reduce((s, r) => s + r.totalCounted, 0);
  const mismatches = sessions.filter((r) => r.status === "mismatch").length;

  downloadPdf(
    "Counting Reconciliation Report",
    `${sessions.length} sessions · ${new Date().toLocaleDateString()}`,
    [
      {
        title: "Summary",
        summary: [
          { label: "Total Expected", value: String(totalExpected) },
          { label: "Total Counted", value: String(totalCounted) },
          { label: "Discrepancy", value: String(totalCounted - totalExpected) },
          { label: "Mismatches", value: String(mismatches) },
          { label: "Accuracy", value: totalExpected > 0 ? `${((totalCounted / totalExpected) * 100).toFixed(1)}%` : "—" },
          { label: "Sessions", value: String(sessions.length) },
        ],
      },
      {
        title: "Session Details",
        table: {
          headers: ["Manifest", "Vehicle", "Zone", "Expected", "Counted", "Variance", "Confidence", "Status"],
          rows: sessions.map((r) => [
            r.manifestCode,
            r.vehicleNumber,
            r.zone,
            r.totalExpected,
            r.totalCounted,
            r.discrepancy,
            `${r.confidenceAvg.toFixed(1)}%`,
            r.status.toUpperCase(),
          ]),
        },
      },
    ],
  );
}

export function exportVehicleLog(logs: {
  plate_number: string;
  gate_code: string | null;
  decision: string;
  direction: string;
  plate_confidence: number;
  denied_reason: string | null;
  processed_at: string;
}[]) {
  const granted = logs.filter((l) => l.decision === "granted").length;
  const denied = logs.filter((l) => l.decision === "denied").length;

  downloadPdf(
    "Vehicle Access Log Report",
    `${logs.length} entries · ${new Date().toLocaleDateString()}`,
    [
      {
        title: "Summary",
        summary: [
          { label: "Total Scans", value: String(logs.length) },
          { label: "Granted", value: String(granted) },
          { label: "Denied", value: String(denied) },
        ],
      },
      {
        title: "Access Log",
        table: {
          headers: ["Time", "Gate", "Plate", "Direction", "Decision", "Confidence", "Reason"],
          rows: logs.map((l) => [
            new Date(l.processed_at).toLocaleString(),
            l.gate_code || "—",
            l.plate_number,
            l.direction,
            l.decision.toUpperCase(),
            `${(l.plate_confidence * 100).toFixed(1)}%`,
            l.denied_reason || "—",
          ]),
        },
      },
    ],
  );
}

export function exportIncidentReport(incidents: {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string | null;
  escalated_to: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}[]) {
  const open = incidents.filter((i) => i.status === "open").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const critical = incidents.filter((i) => i.severity === "critical").length;

  downloadPdf(
    "Security Incident Report",
    `${incidents.length} incidents · ${new Date().toLocaleDateString()}`,
    [
      {
        title: "Summary",
        summary: [
          { label: "Total Incidents", value: String(incidents.length) },
          { label: "Open", value: String(open) },
          { label: "Resolved", value: String(resolved) },
          { label: "Critical", value: String(critical) },
        ],
      },
      {
        title: "Incident Details",
        table: {
          headers: ["ID", "Title", "Severity", "Status", "Escalated To", "Created", "Resolved"],
          rows: incidents.map((i) => [
            i.id.slice(0, 8),
            i.title,
            i.severity.toUpperCase(),
            i.status.toUpperCase(),
            i.escalated_to || "—",
            new Date(i.created_at).toLocaleString(),
            i.resolved_at ? new Date(i.resolved_at).toLocaleString() : "—",
          ]),
        },
      },
    ],
  );
}

export function exportCountingCsv(sessions: {
  manifestCode: string;
  vehicleNumber: string;
  zone: string;
  camera: string;
  expectedBags: number;
  expectedBoxes: number;
  countedBags: number;
  countedBoxes: number;
  totalExpected: number;
  totalCounted: number;
  discrepancy: number;
  confidenceAvg: number;
  status: string;
  timestamp: string;
}[]) {
  downloadCsv(
    `counting-report-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Manifest Code", "Vehicle", "Zone", "Camera", "Expected Bags", "Expected Boxes", "Counted Bags", "Counted Boxes", "Total Expected", "Total Counted", "Discrepancy", "Confidence", "Status", "Time"],
    sessions.map((r) => [
      r.manifestCode, r.vehicleNumber, r.zone, r.camera,
      r.expectedBags, r.expectedBoxes, r.countedBags, r.countedBoxes,
      r.totalExpected, r.totalCounted, r.discrepancy,
      `${r.confidenceAvg.toFixed(1)}%`, r.status, r.timestamp,
    ]),
  );
}
