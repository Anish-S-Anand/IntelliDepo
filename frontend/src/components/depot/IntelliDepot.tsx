'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  LayoutGrid,
  Eye,
  Video,
  Settings,
  BarChart3,
  Grid3x3,
  Layers,
  Lock,
  Bell,
  TrendingUp,
  AreaChart,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function IntelliDepot() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    // Apply theme to HTML
    const htmlElement = document.documentElement;
    if (theme === 'light') {
      htmlElement.classList.add('light-theme');
    } else {
      htmlElement.classList.remove('light-theme');
    }
  }, [theme]);

  const navigationItems = [
    { id: 'dashboard', icon: LayoutGrid, label: 'DASH' },
    { id: 'vision', icon: Eye, label: 'VISION' },
    { id: 'video', icon: Video, label: 'VIDEO' },
    { id: 'command', icon: Settings, label: 'COMMAND' },
    { id: 'analytics', icon: BarChart3, label: 'ANALYTICS' },
    { id: 'zones', icon: Grid3x3, label: 'ZONES' },
    // { id: 'sequencing', icon: Layers, label: 'SEQ' },
    { id: 'perimeter', icon: Lock, label: 'PERI' },
    { id: 'alerts', icon: Bell, label: 'ALERTS' },
    { id: 'risk', icon: TrendingUp, label: 'RISK' },
    { id: 'reporting', icon: AreaChart, label: 'REPORT' },
  ];

  return (
    <div className="intelli-depot" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <style>{`
        :root {
          --acc: #E5521A;
          --acc-light: #FF7A42;
          --acc-deep: #C43A08;
          --acc-glow: rgba(229,82,26,0.18);
          --acc-soft: rgba(229,82,26,0.08);
          --sev-critical: #991B1B;
          --sev-high: #F97316;
          --sev-medium: #CA8A04;
          --sev-low: #16A34A;
          --pos: #22C55E;
          --warn: #F59E0B;
          --info: #3B82F6;
          --danger: #EF4444;
          --bg: #080D18;
          --surf: #0D1526;
          --card: #111E35;
          --nav-bg: #0B1220;
          --bord: #1C2D4F;
          --bord2: #243558;
          --inp: #0D1526;
          --badge: #0A1020;
          --text: #E8EDF8;
          --sub: #7A8FAE;
          --mut: #4A5E7A;
          --shadow-card: 0 2px 16px rgba(0,0,0,0.4);
          --shadow-orange: 0 4px 24px rgba(229,82,26,0.15);
        }
        
        .light-theme {
          --bg: #F0F4FA;
          --surf: #FFFFFF;
          --card: #FFFFFF;
          --nav-bg: #FFFFFF;
          --bord: #DDE3EF;
          --bord2: #C8D2E4;
          --inp: #F5F7FC;
          --badge: #F0F4FA;
          --text: #0F1C33;
          --sub: #1F2937;
          --mut: #374151;
          --shadow-card: 0 2px 16px rgba(0,0,0,0.06);
          --shadow-orange: 0 4px 24px rgba(229,82,26,0.08);
        }

        .intelli-depot {
          display: grid;
          grid-template-columns: 204px 1fr;
          grid-template-rows: 60px 1fr;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
          transition: background 0.3s, color 0.3s;
        }

        .intelli-topbar {
          grid-column: 1/-1;
          grid-row: 1;
          background: var(--nav-bg);
          border-bottom: 1px solid var(--bord);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 10px;
          z-index: 300;
        }

        .intelli-sidebar {
          grid-column: 1;
          grid-row: 2;
          background: var(--nav-bg);
          border-right: 1px solid var(--bord);
          display: flex;
          flex-direction: column;
          padding: 10px 8px;
          gap: 3px;
          overflow-y: auto;
        }

        .intelli-content {
          grid-column: 2;
          grid-row: 2;
          overflow-y: auto;
          background: var(--bg);
          padding: 24px;
        }

        .nav-item-btn {
          width: 100%;
          min-height: 50px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--mut);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 8px 4px;
          transition: 0.18s;
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
        }

        .nav-item-btn:hover {
          background: var(--acc-soft);
          color: var(--sub);
        }

        .nav-item-btn.active {
          background: rgba(229,82,26,0.12);
          color: var(--acc);
          border-color: rgba(229,82,26,0.22);
          position: relative;
        }

        .nav-item-btn.active::before {
          content: '';
          position: absolute;
          left: -9px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 28px;
          background: var(--acc);
          border-radius: 0 3px 3px 0;
        }

        .logo-wrap {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-shrink: 0;
        }

        .logo-img {
          width: 28px;
          height: 28px;
        }

            <div className="logo-text-name">IntelliDepot</div>
          font-size: 18px;
          font-weight: 800;
          color: var(--acc);
          letter-spacing: -0.4px;
        }

        .logo-text-sub {
          font-size: 10px;
          color: var(--sub);
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .theme-toggle {
          width: 64px;
          height: 28px;
          border-radius: 14px;
          border: 1px solid var(--bord);
          background: var(--inp);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px 3px;
          position: relative;
          flex-shrink: 0;
        }

        .toggle-knob {
          width: 22px;
          height: 22px;
          border-radius: 11px;
          background: var(--acc);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          position: absolute;
          left: 3px;
          transition: transform 0.3s;
        }

        .theme-toggle.light-pos .toggle-knob {
          transform: translateX(36px);
        }

        .page-title {
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .page-sub {
          font-size: 15px;
          color: var(--sub);
          margin-bottom: 20px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .kpi-card {
          background: var(--card);
          border: 1px solid var(--bord);
          border-radius: 12px;
          padding: 16px;
          box-shadow: var(--shadow-card);
          transition: 0.22s;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
          border-color: rgba(229,82,26,0.25);
        }

        .kpi-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--sub);
          margin-bottom: 10px;
        }

        .kpi-value {
          font-size: 30px;
          font-weight: 700;
          color: var(--text);
        }

        .kpi-unit {
          font-size: 12px;
          color: var(--sub);
          margin-top: 4px;
        }

        @media (max-width: 768px) {
          .intelli-depot {
            grid-template-columns: 1fr;
          }
          .intelli-sidebar {
            display: none;
          }
          .intelli-content {
            grid-column: 1;
          }
        }
      `}</style>

      {/* TOPBAR */}
      <div className="intelli-topbar">
        <div className="logo-wrap">
          <Image
            src="/fidelis-logo.png"
            alt="Fidelis"
            width={28}
            height={28}
            className="logo-img"
          />
          <div className="hidden sm:flex flex-col">
            <div className="logo-text-name">IntelliDepot</div>
            <div className="logo-text-sub">Fidelis</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div className="hidden sm:flex items-center gap-3">
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--pos)", fontWeight: 700 }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: "var(--pos)" }} />
            LIVE
          </span>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{ width: "64px" }}
          >
            <div className={`toggle-knob ${theme === "light" ? "light-pos" : ""}`}>
              {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            </div>
          </button>
          <button
            onClick={() => {}}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '7px',
              border: '1px solid var(--bord)',
              background: 'transparent',
              color: 'var(--sub)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: '0.2s',
            }}
          >
            <LogOut style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <div
        className="intelli-sidebar"
        style={{
          display: mobileMenuOpen ? 'flex' : 'none',
        }}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.id);
                setMobileMenuOpen(false);
              }}
              title={item.label}
            >
              <Icon style={{ width: '20px', height: '20px' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div className="intelli-content">
        {activePage === 'dashboard' && (
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-sub">Real-time operations monitoring and analytics</p>
            
            <div className="dashboard-grid">
              <div className="kpi-card">
                <div className="kpi-label">Active Cameras</div>
                <div className="kpi-value">48</div>
                <div className="kpi-unit">units online</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Alerts Today</div>
                <div className="kpi-value">12</div>
                <div className="kpi-unit">active incidents</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">System Health</div>
                <div className="kpi-value">98%</div>
                <div className="kpi-unit">operational</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Avg Response</div>
                <div className="kpi-value">2.4s</div>
                <div className="kpi-unit">detection time</div>
              </div>
            </div>

            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--bord)',
                borderRadius: '12px',
                padding: '24px',
                marginTop: '20px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: 'var(--text)' }}>
                Recent Activity
              </h3>
              <p style={{ color: 'var(--sub)', fontSize: '14px' }}>
                No recent incidents. System operating normally.
              </p>
            </div>
          </div>
        )}

        {activePage !== 'dashboard' && (
          <div>
            <h1 className="page-title">{navigationItems.find(i => i.id === activePage)?.label}</h1>
            <p className="page-sub">Section content coming soon</p>
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--bord)',
                borderRadius: '12px',
                padding: '24px',
                marginTop: '20px',
              }}
            >
              <p style={{ color: 'var(--sub)', fontSize: '14px' }}>
                This section is under development. Check back soon for updates.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
