"use client";

export default function SettingsPage() {
  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
          System Settings
        </h1>
        <p className="text-[11px] text-[#8A9BBF] mt-0.5">
          Platform configuration, alerts, integrations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alert Thresholds */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="text-[13px] font-bold text-[#E8EDF8] mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
            Alert Thresholds
          </div>
          <div className="space-y-3.5">
            {[
              { label: "FIFO Compliance Warning Threshold", value: "90%", pct: 90, color: "#E5521A" },
              { label: "Cluster Capacity Critical Threshold", value: "95%", pct: 95, color: "#F04A4A" },
              { label: "SLA Dwell Threshold (min)", value: "30", pct: 60, color: "#F5A623" },
            ].map((t) => (
              <div key={t.label}>
                <div className="text-[11px] text-[#8A9BBF] mb-1.5">{t.label}</div>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#E8EDF8] min-w-[32px]">{t.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="text-[13px] font-bold text-[#E8EDF8] mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
            Integrations
          </div>
          <div className="space-y-2.5">
            {[
              { name: "SAP ERP Connector", status: "● Connected", badge: "LIVE", badgeCol: "#22D3A1" },
              { name: "CCTV DVR API", status: "● 14 cameras active", badge: "LIVE", badgeCol: "#22D3A1" },
              { name: "SMS / WhatsApp Alerts", status: "Twillio Gateway", badge: "ENABLED", badgeCol: "#E5521A" },
            ].map((int) => (
              <div key={int.name} className="flex justify-between items-center p-2.5 bg-[#0F1A30] rounded-[10px]">
                <div>
                  <div className="text-[12px] font-semibold text-[#E8EDF8]">{int.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: int.badgeCol }}>{int.status}</div>
                </div>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{
                    background: `${int.badgeCol}10`,
                    color: int.badgeCol,
                    borderColor: `${int.badgeCol}20`,
                  }}
                >
                  {int.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
