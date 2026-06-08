"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  User,
  Clock,
  Shield,
  Bell,
  Plug,
  Moon,
  Sun,
  ChevronRight,
  Camera,
  Key,
  Smartphone,
  Globe,
  Activity,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/components/layout/ThemeProvider";

type Tab = "account" | "activity" | "security" | "notifications" | "integrations" | "appearance";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account Profile", icon: User },
  { id: "activity", label: "Activity & Time Spent", icon: Clock },
  { id: "security", label: "Security & Privacy", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "appearance", label: "Appearance", icon: Moon },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  useEffect(() => {
    const tab = searchParams.get("tab") as Tab | null;
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease] max-w-5xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">
          Settings
        </h1>
        <p className="text-[11px] text-[#8A9BBF] mt-0.5">
          Manage your account, security, notifications, and platform preferences
        </p>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Sidebar nav */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] overflow-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#1E2F50] last:border-b-0 ${
                    isActive
                      ? "theme-bg-accent-subtle theme-text-nav-active"
                      : "text-[#8A9BBF] hover:bg-[#1E2F50] hover:text-[#E8EDF8]"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[12px] font-semibold">{tab.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "account" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Profile Information</h2>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C43A08] to-[var(--accent)] flex items-center justify-center text-[22px] font-extrabold text-white">
                    {user?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "OP"}
                  </div>
                  <div>
                    <div className="text-[16px] font-bold text-[#E8EDF8]">{user?.full_name || "Operator"}</div>
                    <div className="text-[12px] text-[#8A9BBF]">{user?.email || "operator@intelli.com"}</div>
                    <div className="text-[10px] theme-text-nav-active font-semibold uppercase mt-1">{user?.role || "Admin"}</div>
                  </div>
                  <button className="ml-auto px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[var(--accent-border)] hover:theme-text-nav-active transition flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Change Photo
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Full Name", value: user?.full_name || "Login required" },
                    { label: "Email Address", value: user?.email || "No active account" },
                    { label: "Role", value: user?.role || "Unauthenticated" },
                    { label: "Location", value: user?.location || "No assigned location" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">
                        {field.label}
                      </label>
                      <input
                        defaultValue={field.value}
                        className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[var(--accent-border)]"
                      />
                    </div>
                  ))}
                </div>
                <button className="mt-4 px-4 py-2 rounded-lg theme-bg-accent text-white text-[12px] font-bold hover:bg-[var(--accent-hover)] transition">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Session Activity</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Today", value: "4h 32m", icon: Clock, color: "#5B9BF5" },
                    { label: "This Week", value: "22h 15m", icon: Activity, color: "#22D3A1" },
                    { label: "This Month", value: "87h 40m", icon: Globe, color: "var(--accent)" },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="bg-[#0F1A30] rounded-xl p-3 text-center">
                        <Icon className="w-5 h-5 mx-auto mb-1.5" style={{ color: s.color }} />
                        <div className="text-[18px] font-extrabold text-[#E8EDF8]">{s.value}</div>
                        <div className="text-[10px] text-[#4E6090]">{s.label}</div>
                      </div>
                    );
                  })}
                </div>
                <h3 className="text-[12px] font-bold text-[#E8EDF8] mb-3">Recent Sessions</h3>
                <div className="space-y-2">
                  {[
                    { date: "Today, 09:14 AM", duration: "2h 18m", device: "Chrome · Windows", location: "Mumbai" },
                    { date: "Yesterday, 02:30 PM", duration: "1h 45m", device: "Chrome · Windows", location: "Mumbai" },
                    { date: "Apr 27, 10:00 AM", duration: "3h 02m", device: "Safari · macOS", location: "Delhi" },
                  ].map((session, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-[#0F1A30] rounded-xl">
                      <div>
                        <div className="text-[12px] font-semibold text-[#E8EDF8]">{session.date}</div>
                        <div className="text-[10px] text-[#4E6090]">{session.device} · {session.location}</div>
                      </div>
                      <div className="text-[11px] font-bold text-[#22D3A1]">{session.duration}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Security Settings</h2>
                <div className="space-y-3">
                  {[
                    { label: "Change Password", desc: "Update your account password", icon: Key, action: "Update" },
                    { label: "Two-Factor Authentication", desc: "Add an extra layer of security", icon: Smartphone, action: "Enable" },
                    { label: "Active Sessions", desc: "Manage devices logged in to your account", icon: Globe, action: "View" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center justify-between p-3.5 bg-[#0F1A30] rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#1E2F50] flex items-center justify-center">
                            <Icon className="w-4 h-4 text-[#5B9BF5]" />
                          </div>
                          <div>
                            <div className="text-[12px] font-semibold text-[#E8EDF8]">{item.label}</div>
                            <div className="text-[10px] text-[#4E6090]">{item.desc}</div>
                          </div>
                        </div>
                        <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[var(--accent-border)] hover:theme-text-nav-active transition">
                          {item.action}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Notification Preferences</h2>
                <div className="space-y-3">
                  {[
                    { label: "Critical Incidents", desc: "Immediate alerts for critical events", enabled: true },
                    { label: "Perimeter Breaches", desc: "Alerts when perimeter zones are breached", enabled: true },
                    { label: "Inventory Warnings", desc: "Low stock and FIFO compliance alerts", enabled: true },
                    { label: "SLA Violations", desc: "Alerts when SLA thresholds are exceeded", enabled: false },
                    { label: "System Updates", desc: "Platform maintenance and update notices", enabled: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3.5 bg-[#0F1A30] rounded-xl">
                      <div>
                        <div className="text-[12px] font-semibold text-[#E8EDF8]">{item.label}</div>
                        <div className="text-[10px] text-[#4E6090]">{item.desc}</div>
                      </div>
                      <div
                        className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                          item.enabled ? "bg-[#22D3A1]" : "bg-[#1E2F50]"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                            item.enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alert Thresholds */}
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Alert Thresholds</h2>
                <div className="space-y-3.5">
                  {[
                    { label: "FIFO Compliance Warning Threshold", value: "90%", pct: 90, color: "var(--accent)" },
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
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Connected Integrations</h2>
                <div className="space-y-2.5">
                  {[
                    { name: "SAP ERP Connector", status: "● Connected", badge: "LIVE", badgeCol: "#22D3A1" },
                    { name: "CCTV DVR API", status: "● 6 cameras active", badge: "LIVE", badgeCol: "#22D3A1" },
                    { name: "SMS / WhatsApp Alerts", status: "Twilio Gateway", badge: "ENABLED", badgeCol: "var(--accent)" },
                    { name: "LPR Engine", status: "Tesseract.js + Custom Model", badge: "ACTIVE", badgeCol: "#5B9BF5" },
                  ].map((int) => (
                    <div key={int.name} className="flex justify-between items-center p-3 bg-[#0F1A30] rounded-xl">
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
          )}

          {activeTab === "appearance" && (
            <div className="space-y-4">
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5">
                <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-4">Theme & Appearance</h2>
                <div className="space-y-4">
                  <div>
                    <div className="text-[12px] font-semibold text-[#E8EDF8] mb-3">Color Theme</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => theme === "dark" && toggleTheme()}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === "light"
                            ? "border-[var(--accent)] theme-bg-accent-subtle"
                            : "border-[#1E2F50] hover:border-[#2A3F68]"
                        }`}
                      >
                        <Sun className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                        <div className="text-[12px] font-bold text-[#E8EDF8]">Light Mode</div>
                        <div className="text-[10px] text-[#4E6090]">Black text on white</div>
                      </button>
                      <button
                        onClick={() => theme === "light" && toggleTheme()}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          theme === "dark"
                            ? "border-[var(--accent)] theme-bg-accent-subtle"
                            : "border-[#1E2F50] hover:border-[#2A3F68]"
                        }`}
                      >
                        <Moon className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                        <div className="text-[12px] font-bold text-[#E8EDF8]">Dark Mode</div>
                        <div className="text-[10px] text-[#4E6090]">White text on dark</div>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#E8EDF8] mb-2">Font</div>
                    <div className="p-3 bg-[#0F1A30] rounded-xl text-[12px] text-[#8A9BBF]">
                      Arial Bold — applied globally across all UI elements
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPageSkeleton() {
  return (
    <div className="p-5 animate-pulse max-w-5xl">
      <div className="route-skeleton-bar h-7 w-52 mb-4" />
      <div className="route-skeleton-bar h-4 w-40 mb-6" />
      <div className="flex gap-5 flex-col lg:flex-row">
        <div className="lg:w-56 flex-shrink-0">
          <div className="route-skeleton-bar h-64 rounded-lg" />
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="route-skeleton-bar h-32 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
