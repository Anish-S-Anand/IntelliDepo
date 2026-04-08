"use client";

import { useState } from "react";

const kpis = [
  { label: "Interest Rates (FED)", value: "5.50%", badge: "UNCHANGED", badgeColor: "bg-green-100 text-green-700", chart: "bars" },
  { label: "CPI Inflation (YOY)", value: "3.10%", badge: "+0.2%", badgeColor: "bg-red-100 text-red-600", chart: "line" },
  { label: "USD / EUR", value: "1.084", badge: "-0.15%", badgeColor: "bg-red-100 text-red-600", chart: "range", sub: "L: 1.075   H: 1.092" },
  { label: "Gold Spot (OZ)", value: "$2,165", badge: "+1.4%", badgeColor: "bg-green-100 text-green-700", sub: "MARKET OPEN • BULLISH SENTIMENT" },
];

const regions = [
  { name: "North America", sub: "Market Neutral", status: "STABLE", statusColor: "bg-green-500", liquidity: 80, score: "8.4 / 10" },
  { name: "EMEA", sub: "Policy Shift Imminent", status: "CAUTION", statusColor: "bg-yellow-500", liquidity: 45, score: "6.1 / 10" },
  { name: "APAC", sub: "Growth Acceleration", status: "BULLISH", statusColor: "bg-blue-600", liquidity: 88, score: "9.2 / 10" },
];

export default function DashboardSummaryPage() {
  const [chartType, setChartType] = useState<"Line" | "Bar" | "Area">("Line");
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f4f6fb] lg:h-screen">
      <header className="shrink-0 border-b border-slate-100 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          <h1 className="text-lg font-bold text-slate-800">Dashboard Overview</h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-5 text-sm font-medium">
            <button className="text-blue-600 font-semibold">Overview</button>
            <button className="text-slate-500 hover:text-slate-700">Analytics</button>
            <button className="text-slate-500 hover:text-slate-700">Reports</button>
          </nav>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">JD</div>
        </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden px-8 py-6">
          <div className="flex h-full flex-col gap-5 overflow-hidden">
          <div className="grid shrink-0 gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{kpi.label}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[1.55rem] font-black text-slate-900 leading-none">{kpi.value}</p>
                  {kpi.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${kpi.badgeColor}`}>{kpi.badge}</span>}
                </div>
                {kpi.sub && <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">{kpi.sub}</p>}
                {kpi.chart==="bars" && <div className="mt-3 flex items-end gap-1 h-8">{[30,40,35,50,45,70].map((h,i)=><div key={i} className={`flex-1 rounded-sm ${i===5?"bg-blue-600":"bg-slate-200"}`} style={{height:`${h}%`}}/>)}</div>}
                {kpi.chart==="line" && <svg className="mt-3 w-full h-8" viewBox="0 0 80 32"><polyline points="0,28 15,20 30,22 45,12 60,16 80,8" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>}
                {kpi.chart==="range" && <div className="mt-3 flex items-center gap-1"><div className="flex-1 h-1.5 bg-slate-200 rounded-full"><div className="h-1.5 bg-blue-500 rounded-full" style={{width:"55%"}}/></div><div className="w-2 h-2 rounded-full bg-blue-600 shrink-0"/></div>}
              </div>
            ))}
          </div>
          <div className="grid shrink-0 gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Global Economic Correlation</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Cross-market performance mapping vs. interest rate projections</p>
                </div>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
                  {(["Line","Bar","Area"] as const).map((t)=>(
                    <button key={t} onClick={()=>setChartType(t)} className={`px-3 py-1.5 transition ${chartType===t?"bg-blue-600 text-white":"text-slate-500 hover:bg-slate-50"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-lg overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 h-52 relative">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 480 208" preserveAspectRatio="none">
                  {/* Bar chart — always shown as background columns */}
                  {chartType === "Bar" && [40,60,50,80,65,90,75,100,85,70,95,80,110,90,75,60,85,100,70,90,80,65,95,85].map((h,i)=>(
                    <rect key={i} x={i*20+2} y={208-h-10} width="16" height={h} fill="rgba(99,179,237,0.55)" rx="2"/>
                  ))}
                  {/* Bar+Line combo for Line view */}
                  {chartType === "Line" && <>
                    {[40,60,50,80,65,90,75,100,85,70,95,80,110,90,75,60,85,100,70,90,80,65,95,85].map((h,i)=>(
                      <g key={i}>
                        <rect x={i*20+2} y={208-h-10} width="16" height={h} fill="rgba(99,179,237,0.18)" rx="1"/>
                        <line x1={i*20+10} y1={208-h-18} x2={i*20+10} y2={208-h-10} stroke="rgba(99,179,237,0.4)" strokeWidth="1.5"/>
                      </g>
                    ))}
                    <polyline points="10,170 30,155 50,160 70,140 90,145 110,125 130,130 150,110 170,118 190,130 210,108 230,115 250,95 270,102 290,88 310,95 330,80 350,90 370,75 390,82 410,68 430,75 450,60 470,68" fill="none" stroke="rgba(99,179,237,0.95)" strokeWidth="2.5" strokeLinecap="round"/>
                  </>}
                  {/* Area chart */}
                  {chartType === "Area" && <>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99,179,237,0.55)"/>
                        <stop offset="100%" stopColor="rgba(99,179,237,0.02)"/>
                      </linearGradient>
                    </defs>
                    <polygon points="10,170 30,155 50,160 70,140 90,145 110,125 130,130 150,110 170,118 190,130 210,108 230,115 250,95 270,102 290,88 310,95 330,80 350,90 370,75 390,82 410,68 430,75 450,60 470,68 470,208 10,208" fill="url(#areaGrad)"/>
                    <polyline points="10,170 30,155 50,160 70,140 90,145 110,125 130,130 150,110 170,118 190,130 210,108 230,115 250,95 270,102 290,88 310,95 330,80 350,90 370,75 390,82 410,68 430,75 450,60 470,68" fill="none" stroke="rgba(99,179,237,0.95)" strokeWidth="2.5" strokeLinecap="round"/>
                    {/* Data points */}
                    {[[10,170],[50,160],[90,145],[130,130],[170,118],[210,108],[250,95],[290,88],[330,80],[370,75],[410,68],[450,60]].map(([x,y],i)=>(
                      <circle key={i} cx={x} cy={y} r="3" fill="rgba(99,179,237,1)" stroke="white" strokeWidth="1"/>
                    ))}
                  </>}
                </svg>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                {[{label:"Market Volatility",value:"14.2 VIX"},{label:"Credit Spread",value:"120 BPS"},{label:"GDP Projection",value:"+2.4% Est."}].map((s)=>(
                  <div key={s.label}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p><p className="text-xl font-black text-slate-900 mt-1">{s.value}</p></div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <h3 className="text-base font-bold text-slate-900 mb-3">Strategic Orchestration</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 transition">
                    <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>Run Simulation</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  {["Export Fiscal Report","Query MacroPulse AI"].map((label)=>(
                    <button key={label} className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
                      {label}<svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Risk Sentinel</p>
                <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 rounded-full bg-red-500"/><p className="text-sm font-semibold text-slate-700">3 High-Alert Signals Detected</p></div>
                {[{n:"01",title:"Supply Chain Fragility",desc:"Suez Canal traffic down 45% this week."},{n:"02",title:"Energy Spot Spike",desc:"Brent Crude testing $85 resistance level."}].map((r)=>(
                  <div key={r.n} className="flex gap-3 py-2 border-t border-slate-100"><span className="text-[11px] font-black text-slate-400 mt-0.5">{r.n}</span><div><p className="text-sm font-bold text-slate-800">{r.title}</p><p className="text-xs text-slate-400 mt-0.5">{r.desc}</p></div></div>
                ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Real-Time Regional Flux</h3>
              <button className="text-xs font-bold text-blue-600 hover:underline">VIEW GLOBAL MAP</button>
            </div>
            <div className="grid grid-cols-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-100">
              <span>Region</span><span>Status</span><span>Asset Liquidity</span><span className="text-right">Impact Score</span>
            </div>
            <div className="h-full overflow-auto">
            {regions.map((r)=>(
              <div key={r.name} className="grid grid-cols-4 items-center py-4 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  </div>
                  <div><p className="text-sm font-bold text-slate-800">{r.name}</p><p className="text-[10px] text-slate-400">{r.sub}</p></div>
                </div>
                <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-bold text-white w-fit ${r.statusColor}`}>{r.status}</span>
                <div className="pr-8"><div className="h-1.5 bg-slate-100 rounded-full"><div className="h-1.5 bg-blue-700 rounded-full" style={{width:`${r.liquidity}%`}}/></div></div>
                <p className="text-right text-base font-black text-slate-900">{r.score}</p>
              </div>
            ))}
            </div>
          </div>
          </div>
        </main>
    </div>
  );
}
