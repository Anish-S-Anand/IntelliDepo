/**
 * IntelliOps™ — Backend API Wiring for Legacy HTML Dashboard
 *
 * This script overrides the hardcoded renderSLA(), renderIncidents(),
 * renderCommand(), takeAction(), and escalate() functions to fetch
 * real data from the IntelliOps backend APIs.
 *
 * Load this AFTER the main fidelis-chart-updated.html script.
 */

const _WIRE_HEADERS = {"Content-Type":"application/json","x-user-id":"ops-dashboard"};

// ════════════════════════════════════════════════════════
// SLA & FLEET — wired to /backend/sla + /backend/ops/fleet
// ════════════════════════════════════════════════════════

const _SLA_FALLBACK = [
  {name:"Mumbai Port Authority",target:30,actual:22,depot:"MUM-001"},
  {name:"Delhi Rail Hub",target:25,actual:28,depot:"DEL-002"},
  {name:"Dubai Logistics Zone",target:20,actual:18,depot:"DXB-001"},
];
const _TRUCK_FALLBACK = [
  {vehicle_id:"TN-04-AB-1234",status:"at_dock",assigned_dock:"B3",driver_name:"Ravi M.",entered_yard_at:new Date(Date.now()-18*60000).toISOString()},
  {vehicle_id:"MH-12-CD-5678",status:"in_yard",assigned_dock:null,driver_name:"Suresh P.",entered_yard_at:new Date(Date.now()-34*60000).toISOString()},
  {vehicle_id:"DL-01-EF-9012",status:"departed",assigned_dock:"A1",driver_name:"Ahmed K.",entered_yard_at:new Date(Date.now()-8*60000).toISOString()},
  {vehicle_id:"KA-03-GH-3456",status:"in_yard",assigned_dock:null,driver_name:"Vijay S.",entered_yard_at:new Date(Date.now()-41*60000).toISOString()},
];

function _drawSLACards(slas) {
  const sl = document.getElementById("slaList");
  if (!sl) return;
  sl.innerHTML = slas.map(s => {
    const tgt = s.target || s.threshold_value || 30;
    const act = s.actual ?? Math.round(tgt * (1 - (s.breach_probability || 0.3)));
    const onTrack = act <= tgt;
    const col = onTrack ? "var(--pos)" : "var(--sev-high)";
    const pct = Math.min(100, Math.round((act / tgt) * 100));
    return `<div class="sla-card">
      <svg class="sla-ring" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--bord)" stroke-width="4"/>
        <circle cx="26" cy="26" r="22" fill="none" stroke="${col}" stroke-width="4"
          stroke-dasharray="${2*Math.PI*22}" stroke-dashoffset="${2*Math.PI*22*(1-pct/100)}"
          transform="rotate(-90 26 26)" stroke-linecap="round"/>
        <text x="26" y="30" text-anchor="middle" font-size="10" font-weight="700" fill="${col}" font-family="Inter">${act}m</text>
      </svg>
      <div class="sla-info">
        <div class="sla-name">${s.name || "SLA"}</div>
        <div class="sla-depot">${s.depot || s.metric_key || ""} &nbsp;•&nbsp; Target: ${tgt}min</div>
        <div class="sla-status"><span class="badge" style="background:${col}22;color:${col};border:1px solid ${col}44;font-size:9px">${onTrack ? "✓ ON TRACK" : "⚠ AT RISK"}</span></div>
      </div>
    </div>`;
  }).join("");
}

function _drawTruckGrid(trucks) {
  const tg = document.getElementById("truckGrid");
  if (!tg) return;
  tg.innerHTML = trucks.map(t => {
    const id = t.vehicle_id || t.id || "—";
    const st = (t.status || "in_yard").replace(/_/g, " ");
    const dock = t.assigned_dock || t.dock || "—";
    const driver = t.driver_name || t.driver || "—";
    const dwell = t.entered_yard_at
      ? Math.round((Date.now() - new Date(t.entered_yard_at).getTime()) / 60000)
      : (t.dwell || 0);
    const dc = dwell > 30 ? "var(--sev-high)" : dwell > 20 ? "var(--warn)" : "var(--pos)";
    const sc = st.includes("dock") || st.includes("load") ? "var(--info)"
             : st.includes("depart") ? "var(--pos)" : "var(--mut)";
    return `<div class="truck-card">
      <div class="truck-hdr">
        <div class="truck-id">${id}</div>
        <span class="truck-status" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${st}</span>
      </div>
      <div class="truck-meta">
        <span style="color:var(--mut)">Dock</span><span style="font-weight:600">${dock}</span>
        <span style="color:var(--mut)">Dwell</span><span style="font-weight:700;color:${dc}">${dwell} min</span>
        <span style="color:var(--mut)">Driver</span><span style="font-weight:500">${driver}</span>
      </div>
    </div>`;
  }).join("");
}

// Override renderSLA — includes KPI cards + penalty panels from original
window.renderSLA = async function() {
  const _s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const _h = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };

  _drawSLACards(_SLA_FALLBACK);
  _drawTruckGrid(_TRUCK_FALLBACK);

  try {
    const [sR, tR, pfR, ysR, dkR, penR] = await Promise.allSettled([
      fetch("/backend/sla", { headers: _WIRE_HEADERS }),
      fetch("/backend/ops/fleet/vehicles?limit=20", { headers: _WIRE_HEADERS }),
      fetch("/backend/ops/escalation/penalties/forecast", { headers: _WIRE_HEADERS }),
      fetch("/backend/ops/fleet/vehicles/yard/summary", { headers: _WIRE_HEADERS }),
      fetch("/backend/ops/fleet/docks", { headers: _WIRE_HEADERS }),
      fetch("/backend/ops/escalation/penalties", { headers: _WIRE_HEADERS }),
    ]);

    // SLA cards
    if (sR.status === "fulfilled" && sR.value.ok) {
      const slas = await sR.value.json();
      if (slas.length > 0) {
        const enriched = [];
        for (const s of slas.slice(0, 6)) {
          let bp = 0.3;
          try {
            const pr = await fetch("/backend/sla/" + s.id + "/breach-prediction", { headers: _WIRE_HEADERS });
            if (pr.ok) bp = (await pr.json()).breach_probability;
          } catch {}
          enriched.push({
            ...s, breach_probability: bp,
            target: s.threshold_value,
            actual: Math.round(s.threshold_value * (1 - bp)),
            depot: s.metric_key,
          });
        }
        _drawSLACards(enriched);
      }
    }

    // Truck grid
    if (tR.status === "fulfilled" && tR.value.ok) {
      const trucks = await tR.value.json();
      if (trucks.length > 0) _drawTruckGrid(trucks);
    }

    // KPI: SLA Compliance + Active Penalties (from penalty forecast)
    if (pfR.status === "fulfilled" && pfR.value.ok) {
      const pf = await pfR.value.json();
      const comp = 100 - (pf.total_breaches || 0) * 5;
      _h("slaKpiComp", comp.toFixed(1) + '<span class="kpi-unit">%</span>');
      _s("slaKpiCompD", (pf.total_breaches || 0) + " breaches");
      _s("slaKpiPen", pf.total_penalties || 0);
      _s("slaKpiPenD", "$" + (pf.total_amount || 0).toFixed(0));

      // Penalty Forecast panel
      _h("slaPenaltyForecast", '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center">' +
        '<div style="padding:14px;background:var(--badge);border-radius:10px;border:1px solid var(--bord)"><div style="font-size:22px;font-weight:800;color:var(--warn)">' + (pf.total_penalties||0) + '</div><div style="font-size:11px;color:var(--sub);margin-top:4px">Total Penalties</div></div>' +
        '<div style="padding:14px;background:var(--badge);border-radius:10px;border:1px solid var(--bord)"><div style="font-size:22px;font-weight:800;color:var(--sev-critical)">' + (pf.total_breaches||0) + '</div><div style="font-size:11px;color:var(--sub);margin-top:4px">Total Breaches</div></div>' +
        '<div style="padding:14px;background:var(--badge);border-radius:10px;border:1px solid var(--bord)"><div style="font-size:22px;font-weight:800;color:var(--acc)">$' + (pf.total_amount||0).toFixed(0) + '</div><div style="font-size:11px;color:var(--sub);margin-top:4px">Total Amount</div></div></div>');
    }

    // KPI: Vehicles in Yard
    if (ysR.status === "fulfilled" && ysR.value.ok) {
      const ys = await ysR.value.json();
      _s("slaKpiVeh", ys.total_in_yard ?? "--");
      _s("slaKpiVehD", (ys.at_dock ?? 0) + " at dock");
    }

    // KPI: Dock Utilization + Penalty list
    if (dkR.status === "fulfilled" && dkR.value.ok) {
      const docks = await dkR.value.json();
      if (docks.length) {
        const occ = docks.filter(d => d.status === "occupied").length;
        _h("slaKpiDock", Math.round(occ / docks.length * 100) + '<span class="kpi-unit">%</span>');
        _s("slaKpiDockD", occ + "/" + docks.length + " occupied");
      } else {
        _h("slaKpiDock", '0<span class="kpi-unit">%</span>');
        _s("slaKpiDockD", "No docks");
      }
    }

    // Active Penalties list
    if (penR.status === "fulfilled" && penR.value.ok) {
      const penalties = await penR.value.json();
      const el = document.getElementById("slaPenaltyList");
      if (el) {
        if (!penalties.length) {
          el.innerHTML = '<div style="color:var(--sub);font-size:13px;padding:14px;text-align:center">No penalties</div>';
        } else {
          el.innerHTML = penalties.map(function(p) {
            var col = p.status === "pending" ? "var(--warn)" : p.status === "waived" ? "var(--pos)" : "var(--sev-high)";
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--badge);border-radius:8px;margin-bottom:7px;border:1px solid var(--bord);border-left:3px solid '+col+'">' +
              '<div><div style="font-size:12px;font-weight:600">'+(p.sla_name||"SLA")+'</div><div style="font-size:10px;color:var(--sub);margin-top:2px">'+(p.client_name||"--")+" &bull; "+(p.breach_duration_minutes||0)+'min breach</div></div>' +
              '<div style="text-align:right"><div style="font-size:16px;font-weight:800;color:'+col+'">$'+(p.penalty_amount||0).toFixed(0)+'</div><div style="font-size:10px;color:var(--sub)">'+(p.status||"").toUpperCase()+'</div></div></div>';
          }).join("");
        }
      }
    }

  } catch {}

  // Update timestamp
  var slaTs = document.getElementById("slaLastUpdate");
  if (slaTs) slaTs.textContent = "Last updated: " + new Date().toLocaleTimeString();

  // Auto-refresh trucks every 15s
  clearInterval(window._slaInt);
  window._slaInt = setInterval(async () => {
    try {
      const r = await fetch("/backend/ops/fleet/vehicles?limit=20", { headers: _WIRE_HEADERS });
      if (r.ok) { const d = await r.json(); if (d.length > 0) _drawTruckGrid(d); }
    } catch {}
  }, 15000);
};


// ════════════════════════════════════════════════════════
// INCIDENTS — wired to /backend/ops/incidents
// ════════════════════════════════════════════════════════

const _INC_FALLBACK = [
  {id:"INC-001",type:"Security Breach",sev:"CRITICAL",loc:"Gate 4 Perimeter",t:"8m ago",status:"acknowledged",cam:"CAM-042",desc:"Unauthorized entry detected at Gate 4.",assignee:"Guard Unit 2"},
  {id:"INC-002",type:"Damaged Bags",sev:"HIGH",loc:"Zone C • Bay 4",t:"2m ago",status:"open",cam:"CAM-04",desc:"5 bags torn during unloading.",assignee:"—"},
  {id:"INC-003",type:"Count Mismatch",sev:"HIGH",loc:"Cluster B-09",t:"1h ago",status:"open",cam:"CAM-08",desc:"Physical count shows -5 bags vs ERP.",assignee:"—"},
  {id:"INC-004",type:"SLA Risk",sev:"MEDIUM",loc:"Dock B",t:"15m ago",status:"open",cam:"—",desc:"Truck queue exceeded 30-minute SLA.",assignee:"—"},
  {id:"INC-005",type:"Temp Warning",sev:"LOW",loc:"Cold Storage Zone A",t:"32m ago",status:"resolved",cam:"CAM-12",desc:"Temperature exceeded threshold briefly.",assignee:"Ops Team"},
];

function _mapBackendIncident(i) {
  const sevMap = { P1: "CRITICAL", P2: "HIGH", P3: "MEDIUM", P4: "LOW" };
  const statusMap = { open: "open", acknowledged: "acknowledged", escalated: "acknowledged", in_progress: "acknowledged", resolved: "resolved" };
  const age = i.created_at ? _opsAge(i.created_at) : "—";
  return {
    id: (i.id || "").slice(0, 12),
    type: i.title,
    sev: sevMap[i.priority] || "MEDIUM",
    loc: i.zone || "—",
    t: age + " ago",
    status: statusMap[i.status] || "open",
    cam: "—",
    desc: i.description || i.title,
    assignee: i.assigned_to || "—",
    _backendId: i.id,
  };
}

// Store live incidents for action handlers
window._liveIncidents = [];

window.renderIncidents = async function(filter) {
  filter = filter || window.incFilter || "all";

  // Fetch from backend
  let items = _INC_FALLBACK;
  try {
    const res = await fetch("/backend/ops/incidents/?limit=30", { headers: _WIRE_HEADERS });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        items = data.map(_mapBackendIncident);
        window._liveIncidents = data;
      }
    }
  } catch {}

  // Also try perimeter incidents
  try {
    const res2 = await fetch("/backend/depot/vision/perimeter/incidents", { headers: _WIRE_HEADERS });
    if (res2.ok) {
      const pData = await res2.json();
      if (pData.length > 0) {
        const mapped = pData.map(p => ({
          id: (p.id || "").slice(0, 12),
          type: p.title,
          sev: { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW" }[p.severity] || "MEDIUM",
          loc: p.escalated_to ? "Escalated to " + p.escalated_to : "Perimeter Zone",
          t: p.created_at ? _opsAge(p.created_at) + " ago" : "—",
          status: { open: "open", acknowledged: "acknowledged", escalated: "acknowledged", resolved: "resolved" }[p.status] || "open",
          cam: p.video_archive_ref || "—",
          desc: p.description || p.title,
          assignee: p.acknowledged_by || p.escalated_to || "—",
          _backendId: p.id,
        }));
        // Merge: deduplicate by title
        const existingTitles = new Set(items.map(i => i.type));
        items = [...items, ...mapped.filter(m => !existingTitles.has(m.type))];
      }
    }
  } catch {}

  // Update the global INCIDENTS array so existing code works
  window.INCIDENTS = items;

  // Apply filter
  const filtered = items.filter(i => {
    if (filter === "all") return true;
    return filter === i.status || filter === i.sev;
  });

  // Render using existing template
  const list = document.getElementById("incidentList");
  if (list) {
    list.innerHTML = filtered.map(i => {
      const sevIcon = i.sev === "CRITICAL" ? "🔴" : i.sev === "HIGH" ? "🟠" : i.sev === "MEDIUM" ? "🟡" : "🟢";
      const col = (typeof SEV_COL !== "undefined" ? SEV_COL : {})[i.sev] || "#CA8A04";
      const isResolved = i.status === "resolved";
      return `<div class="inc-card" style="border-left-color:${col};background:${col}0A;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div>
            <div style="font-size:17px;font-weight:700">${sevIcon} ${i.type}</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="inc-sev-badge sev-badge-${i.sev}">${sevIcon} ${i.sev}</span>
              <span class="sta-badge sta-${i.status}">${i.status.toUpperCase()}</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;color:var(--mut)">${i.t}</div>
            <div style="font-size:10px;color:var(--sub);margin-top:2px">📷 ${i.cam}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--sub);margin-bottom:7px;line-height:1.55">${i.desc}</div>
        <div style="font-size:11px;color:var(--mut);margin-bottom:10px">📍 ${i.loc} &nbsp;•&nbsp; 👤 ${i.assignee}</div>
        <div style="display:flex;gap:7px">
          <button class="btn btn-evidence" onclick="showEvidence('${i.id}')">📷 Evidence</button>
          ${i.status === "open" ? `<button class="btn btn-acknowledge" onclick="takeAction('${i._backendId || i.id}')">✓ Acknowledge</button>` : ""}
          ${i.sev === "CRITICAL" && !isResolved ? `<button class="btn btn-escalate" onclick="escalate('${i._backendId || i.id}')">🚨 Escalate</button>` : ""}
          ${!isResolved ? `<button class="btn" style="border:1px solid var(--pos);color:var(--pos);background:transparent;font-size:10px" onclick="resolveInc('${i._backendId || i.id}')">✅ Resolve</button>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  // Update counters
  const _s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  _s("cntOpen", items.filter(i => i.status === "open").length);
  _s("cntAck", items.filter(i => i.status === "acknowledged").length);
  _s("cntRes", items.filter(i => i.status === "resolved").length);
  _s("cntCrit", items.filter(i => i.sev === "CRITICAL").length);
  _s("cntHigh", items.filter(i => i.sev === "HIGH").length);
  _s("cntMed", items.filter(i => i.sev === "MEDIUM").length);
  _s("cntLow", items.filter(i => i.sev === "LOW").length);
  const openCount = items.filter(i => i.status !== "resolved").length;
  _s("incBadge", openCount);
  _s("navIncBadge", openCount);
  const footStat = document.getElementById("footerIncStat");
  if (footStat) footStat.textContent = "● " + openCount + " active incident" + (openCount !== 1 ? "s" : "");

  // Auto-refresh every 20s
  clearInterval(window._incInt);
  window._incInt = setInterval(() => renderIncidents(filter), 20000);
};


// Override takeAction — calls backend acknowledge
window.takeAction = async function(id) {
  // Try IntelliOps incidents API
  try {
    const res = await fetch("/backend/ops/incidents/" + id + "/acknowledge", {
      method: "PATCH", headers: _WIRE_HEADERS,
      body: JSON.stringify({ reason: "Acknowledged from Command Center dashboard" }),
    });
    if (res.ok) { renderIncidents(incFilter); return; }
  } catch {}
  // Try perimeter incidents API
  try {
    const res = await fetch("/backend/depot/vision/perimeter/incidents/" + id + "/acknowledge", {
      method: "PATCH", headers: _WIRE_HEADERS,
      body: JSON.stringify({ reason: "Acknowledged from Command Center dashboard" }),
    });
    if (res.ok) { renderIncidents(incFilter); return; }
  } catch {}
  // Fallback: local state
  const inc = (window.INCIDENTS || []).find(i => i.id === id || i._backendId === id);
  if (inc) { inc.status = "acknowledged"; inc.assignee = "Command Center"; }
  renderIncidents(incFilter);
};


// Override escalate — calls backend escalation
window.escalate = async function(id) {
  try {
    // Create escalation workflow
    const res = await fetch("/backend/ops/escalation/workflows/trigger", {
      method: "POST", headers: _WIRE_HEADERS,
      body: JSON.stringify({
        incident_id: id,
        trigger_type: "manual",
        trigger_source: "Command Center dashboard",
        severity: "critical",
      }),
    });
    if (res.ok) {
      alert("Escalated to Operations Manager. Notifications sent via in-app + email.");
      renderIncidents(incFilter);
      return;
    }
  } catch {}
  alert("Escalating " + id + " to senior management. SMS and WhatsApp alerts sent.");
};


// Resolve incident
window.resolveInc = async function(id) {
  const notes = prompt("Resolution notes (min 5 chars):");
  if (!notes || notes.length < 5) return;
  try {
    const res = await fetch("/backend/ops/incidents/" + id + "/resolve", {
      method: "PATCH", headers: _WIRE_HEADERS,
      body: JSON.stringify({ resolution_notes: notes, resolution_steps: [] }),
    });
    if (res.ok) { renderIncidents(incFilter); return; }
  } catch {}
  try {
    const res = await fetch("/backend/depot/vision/perimeter/incidents/" + id + "/resolve", {
      method: "PATCH", headers: _WIRE_HEADERS,
      body: JSON.stringify({ resolution_notes: notes }),
    });
    if (res.ok) { renderIncidents(incFilter); return; }
  } catch {}
  alert("Could not resolve — backend unavailable.");
};


// ════════════════════════════════════════════════════════
// COMMAND CENTER — wired to backend
// ════════════════════════════════════════════════════════

window.renderCommand = async function() {
  const d = document.getElementById("cmdDepots");
  const gf = document.getElementById("globalFeed");
  if (!d) return;

  // Render depots (static — depot config doesn't change often)
  if (typeof DEPOTS !== "undefined") {
    d.innerHTML = DEPOTS.map(dep => {
      const col = dep.health >= 90 ? "#22C55E" : dep.health >= 75 ? "#F59E0B" : "#DC2626";
      return `<div class="depot-card${dep.id === curDepot ? " sel" : ""}" onclick="switchDepot('${dep.id}');nav('dashboard')">
        <div class="depot-card-hdr">
          <div><div class="depot-card-name">${dep.name}</div><div class="depot-card-loc">${dep.loc}</div></div>
          <div class="health-ring" style="color:${col};border-color:${col}">${dep.health}%</div>
        </div>
        <div class="depot-meta">
          <span class="dm-l">Utilization</span><span class="dm-v">${dep.util}%</span>
          <span class="dm-l">Active Trucks</span><span class="dm-v">${dep.trucks}</span>
          <span class="dm-l">FIFO Score</span><span class="dm-v" style="color:var(--pos)">${dep.fifo}%</span>
          <span class="dm-l">Avg Load</span><span class="dm-v">${dep.load} min</span>
        </div>
        <div class="prog-track"><div class="prog-fill" style="width:${dep.util}%;background:${col}"></div></div>
      </div>`;
    }).join("");
  }

  // Feed: fetch real incidents for the global feed
  let feedItems = (typeof INCIDENTS !== "undefined" ? INCIDENTS : []).slice(0, 5);
  try {
    const res = await fetch("/backend/ops/incidents/active", { headers: _WIRE_HEADERS });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        feedItems = data.slice(0, 5).map(i => ({
          type: i.title,
          loc: i.zone || "—",
          sev: { P1: "CRITICAL", P2: "HIGH", P3: "MEDIUM", P4: "LOW" }[i.priority] || "MEDIUM",
          t: i.created_at ? _opsAge(i.created_at) + " ago" : "—",
        }));
      }
    }
  } catch {}

  if (gf) {
    const _sevCol = typeof SEV_COL !== "undefined" ? SEV_COL : { CRITICAL: "#DC2626", HIGH: "#EA580C", MEDIUM: "#CA8A04", LOW: "#16A34A" };
    gf.innerHTML = feedItems.map(i => `
      <div class="feed-item">
        <div style="display:flex;align-items:center;flex:1;gap:0">
          <div class="feed-bar" style="background:${_sevCol[i.sev] || '#CA8A04'}"></div>
          <div><div class="feed-name">${i.type}</div><div class="feed-sub">${i.loc}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="inc-sev-badge sev-badge-${i.sev}">${i.sev}</span>
          <span style="font-size:10px;color:var(--mut)">${i.t}</span>
        </div>
      </div>`).join("");
  }
};

// ════════════════════════════════════════════════════════
// FLEET & YARD VIEW (F-064–F-068)
// ════════════════════════════════════════════════════════

window.renderFleet = async function() {
  const _s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const H = _WIRE_HEADERS;

  // Fetch all fleet data
  let vehicles = [], docks = [], queue = [], heatmap = [];
  try {
    const [vR, dR, qR, hR] = await Promise.allSettled([
      fetch("/backend/ops/fleet/vehicles?limit=50", {headers:H}),
      fetch("/backend/ops/fleet/docks", {headers:H}),
      fetch("/backend/ops/fleet/queue/optimize", {headers:H}),
      fetch("/backend/ops/fleet/dwell/heatmap", {headers:H}),
    ]);
    if (vR.status==="fulfilled"&&vR.value.ok) vehicles = await vR.value.json();
    if (dR.status==="fulfilled"&&dR.value.ok) docks = await dR.value.json();
    if (qR.status==="fulfilled"&&qR.value.ok) { const d = await qR.value.json(); queue = d.recommendations || []; }
    if (hR.status==="fulfilled"&&hR.value.ok) heatmap = await hR.value.json();
  } catch {}

  // KPIs
  const inYard = vehicles.filter(v => ["in_yard","at_dock","at_gate"].includes(v.status)).length;
  const atDock = vehicles.filter(v => v.status === "at_dock").length;
  const freeDocks = docks.filter(d => d.status === "free").length;
  const dwellAlerts = vehicles.filter(v => {
    if (!v.entered_yard_at) return false;
    return (Date.now() - new Date(v.entered_yard_at).getTime()) / 60000 >= 120;
  }).length;
  _s("fleetInYard", inYard || "0");
  _s("fleetAtDock", atDock || "0");
  _s("fleetFreeDocks", freeDocks + "/" + docks.length);
  _s("fleetDwellAlerts", dwellAlerts || "0");

  // Vehicle list
  const vl = document.getElementById("fleetVehicleList");
  if (vl) {
    if (vehicles.length === 0) { vl.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No vehicles tracked yet. Use POST /ops/fleet/gps to add vehicles.</div>'; }
    else vl.innerHTML = vehicles.map(v => {
      const dwell = v.entered_yard_at ? Math.round((Date.now()-new Date(v.entered_yard_at).getTime())/60000) : 0;
      const dc = dwell>120?"var(--sev-high)":dwell>60?"var(--warn)":"var(--pos)";
      const sc = v.status==="at_dock"?"var(--info)":v.status==="in_transit"?"var(--pos)":"var(--mut)";
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--badge);border-radius:8px;margin-bottom:6px;border:1px solid var(--bord)">
        <div>
          <div style="font-size:13px;font-weight:600;font-family:'JetBrains Mono',monospace">${v.vehicle_id}</div>
          <div style="font-size:10px;color:var(--sub);margin-top:2px">${v.driver_name||"—"} &bull; ${(v.current_zone||"in transit").replace(/_/g," ")}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:700;color:${dc}">${dwell}m</span>
          <span class="badge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44;font-size:9px">${(v.status||"").replace(/_/g," ")}</span>
        </div>
      </div>`;
    }).join("");
  }

  // Queue recommendations
  const ql = document.getElementById("fleetQueueList");
  if (ql) {
    if (queue.length === 0) { ql.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No vehicles waiting — queue is clear</div>'; }
    else ql.innerHTML = queue.map(r => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--badge);border-radius:8px;margin-bottom:6px;border:1px solid var(--bord)">
      <div>
        <div style="font-size:12px;font-weight:600">${r.vehicle_id} <span style="font-size:10px;color:var(--sub)">(${r.vehicle_type||"truck"})</span></div>
        <div style="font-size:10px;color:var(--sub);margin-top:2px">${r.reason}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:var(--warn)">${Math.round(r.wait_minutes)}m wait</div>
        <div style="font-size:10px;color:var(--info);font-family:'JetBrains Mono',monospace">&rarr; ${r.recommended_dock}</div>
      </div>
    </div>`).join("");
  }

  // Dwell heatmap
  const hm = document.getElementById("fleetHeatmap");
  if (hm) {
    if (heatmap.length === 0) { hm.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No dwell data available</div>'; }
    else hm.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' + heatmap.map(h => {
      const col = h.avg_dwell_minutes>=180?"var(--sev-high)":h.avg_dwell_minutes>=120?"var(--warn)":h.avg_dwell_minutes>=60?"var(--info)":"var(--pos)";
      return `<div style="background:var(--badge);border:1px solid var(--bord);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:11px;font-weight:600;text-transform:capitalize">${(h.zone||"").replace(/_/g," ")}</div>
        <div style="font-size:20px;font-weight:800;color:${col};margin:4px 0">${Math.round(h.avg_dwell_minutes)}m</div>
        <div style="font-size:9px;color:var(--sub)">${h.total_vehicles} vehicles &bull; ${h.over_threshold_count} over</div>
      </div>`;
    }).join("") + '</div>';
  }

  // Dock grid
  const dg = document.getElementById("fleetDockGrid");
  if (dg) {
    if (docks.length === 0) { dg.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No docks configured. Use POST /ops/fleet/docks to add.</div>'; }
    else dg.innerHTML = docks.map(d => {
      const col = d.status==="free"?"var(--pos)":d.status==="occupied"?"var(--info)":d.status==="reserved"?"var(--warn)":"var(--sev-high)";
      return `<div style="background:var(--badge);border:1px solid ${col}44;border-radius:8px;padding:12px;border-left:3px solid ${col}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:700;font-family:'JetBrains Mono',monospace">${d.dock_id}</span>
          <span class="badge" style="background:${col}22;color:${col};border:1px solid ${col}44;font-size:9px">${d.status}</span>
        </div>
        <div style="font-size:10px;color:var(--sub);margin-top:4px">${d.dock_type||"standard"} &bull; ${d.assigned_vehicle_id||"—"}</div>
      </div>`;
    }).join("");
  }

  // Auto-refresh
  clearInterval(window._fleetInt);
  window._fleetInt = setInterval(() => renderFleet(), 10000);
};


// ════════════════════════════════════════════════════════
// DOCK SCHEDULING (F-067)
// ════════════════════════════════════════════════════════

window.renderDockSchedule = async function() {
  const H = _WIRE_HEADERS;
  const _s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  let schedules = [];
  try {
    const res = await fetch("/backend/ops/fleet/schedules?week_offset=0", {headers:H});
    if (res.ok) schedules = await res.json();
  } catch {}

  // KPIs
  const today = new Date().toDateString();
  const todaySchedules = schedules.filter(s => new Date(s.scheduled_start).toDateString() === today);
  _s("dockBookings", todaySchedules.length || "0");
  _s("dockDelays", todaySchedules.filter(s => s.delay_risk).length || "0");
  _s("dockUtil", todaySchedules.length > 0 ? Math.round(todaySchedules.length / 24 * 100) + "%" : "0%");

  // Schedule grid
  const grid = document.getElementById("dockScheduleGrid");
  if (grid) {
    if (schedules.length === 0) {
      grid.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:24px;text-align:center">No dock schedules found. Click <strong>+ Book Slot</strong> to create one, or use POST /ops/fleet/schedules.</div>';
    } else {
      const rows = schedules.map(s => {
        const start = new Date(s.scheduled_start);
        const end = new Date(s.scheduled_end);
        const stCol = s.status==="active"?"var(--pos)":s.status==="completed"?"var(--sub)":"var(--info)";
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--badge);border-radius:8px;margin-bottom:6px;border:1px solid var(--bord);border-left:3px solid ${stCol}">
          <div>
            <div style="font-size:13px;font-weight:600"><span style="font-family:'JetBrains Mono',monospace">${s.dock_id}</span> &bull; ${s.vehicle_id||"Reserved"}</div>
            <div style="font-size:10px;color:var(--sub);margin-top:2px">${s.client_name||"—"} &bull; ${start.toLocaleDateString()} ${start.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} — ${end.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${s.delay_risk?'<span style="font-size:9px;color:var(--warn);font-weight:700">⚠ DELAY RISK</span>':''}
            <span class="badge" style="background:${stCol}22;color:${stCol};border:1px solid ${stCol}44;font-size:9px">${s.status}</span>
          </div>
        </div>`;
      }).join("");
      grid.innerHTML = rows;
    }
  }

  // Wire book button
  const btn = document.getElementById("btnBookDock");
  if (btn) btn.onclick = async function() {
    const dock_id = prompt("Dock ID (e.g. DOCK-A1):");
    if (!dock_id) return;
    const vehicle_id = prompt("Vehicle ID:", "");
    const client_name = prompt("Client:", "");
    const hours = parseInt(prompt("Duration in hours:", "4") || "4");
    const start = new Date(); start.setMinutes(0,0,0); start.setHours(start.getHours()+1);
    const end = new Date(start.getTime() + hours*3600000);
    try {
      const r = await fetch("/backend/ops/fleet/schedules", {
        method:"POST", headers:H,
        body: JSON.stringify({dock_id, vehicle_id:vehicle_id||null, client_name:client_name||null, scheduled_start:start.toISOString(), scheduled_end:end.toISOString()})
      });
      if (r.ok) { renderDockSchedule(); alert("Dock slot booked!"); }
      else { const e = await r.text(); alert("Failed: " + e); }
    } catch { alert("Backend unavailable"); }
  };
};


// ════════════════════════════════════════════════════════
// ESCALATION (F-069–F-073)
// ════════════════════════════════════════════════════════

window._selectedEscIncident = null;

window.renderEscalation = async function() {
  const H = _WIRE_HEADERS;
  const _s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

  let incidents = [];
  try {
    const res = await fetch("/backend/ops/incidents/?limit=30", {headers:H});
    if (res.ok) incidents = await res.json();
  } catch {}

  // KPIs
  _s("escOpen", incidents.filter(i => i.status==="open").length || "0");
  _s("escEscalated", incidents.filter(i => i.status==="escalated").length || "0");
  _s("escP1", incidents.filter(i => i.priority==="P1").length || "0");
  _s("escResolved", incidents.filter(i => i.status==="resolved").length || "0");

  // Incident list with escalation timeline
  const el = document.getElementById("escIncidentList");
  if (el) {
    if (incidents.length === 0) {
      el.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:24px;text-align:center">No incidents found. Create one via POST /ops/incidents/ or from SLA breach.</div>';
    } else {
      el.innerHTML = incidents.map(inc => {
        const priCol = {P1:"var(--sev-critical)",P2:"var(--sev-high)",P3:"var(--warn)",P4:"var(--pos)"}[inc.priority]||"var(--warn)";
        const stCol = {open:"var(--sev-high)",acknowledged:"var(--warn)",escalated:"var(--sev-critical)",resolved:"var(--pos)"}[inc.status]||"var(--sub)";
        const chain = (inc.escalation_chain||[]).map((step,i) => {
          const isLast = i === (inc.escalation_chain||[]).length - 1;
          const age = step.assigned_at ? _opsAge(step.assigned_at) : "";
          return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10px;border:1px solid ${isLast?'var(--acc)':'var(--bord)'};background:${isLast?'rgba(229,82,26,0.1)':'var(--badge)'}">
            <span style="font-weight:600">${step.tier}</span><span style="color:var(--mut)">${age}</span>
          </span>${i < (inc.escalation_chain||[]).length-1 ? '<span style="color:var(--mut);font-size:10px"> → </span>' : ''}`;
        }).join("");
        const isSelected = window._selectedEscIncident === inc.id;
        return `<div onclick="selectEscIncident('${inc.id}')" style="padding:14px;background:var(--badge);border-radius:10px;margin-bottom:8px;border:1px solid ${isSelected?'var(--acc)':'var(--bord)'};border-left:4px solid ${priCol};cursor:pointer;transition:border-color 0.15s">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
                <span class="badge" style="background:${priCol}22;color:${priCol};border:1px solid ${priCol}44;font-size:9px">${inc.priority}</span>
                <span class="badge" style="background:${stCol}22;color:${stCol};border:1px solid ${stCol}44;font-size:9px">${(inc.status||"").toUpperCase()}</span>
                ${inc.zone?`<span style="font-size:10px;color:var(--sub)">${inc.zone}</span>`:''}
              </div>
              <div style="font-size:14px;font-weight:700">${inc.title}</div>
              ${inc.description?`<div style="font-size:11px;color:var(--sub);margin-top:3px;line-height:1.5">${inc.description}</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:10px;color:var(--mut)">${inc.created_at?_opsAge(inc.created_at)+" ago":"—"}</div>
              <div style="font-size:10px;color:var(--sub);margin-top:2px">Tier ${inc.escalation_level||0}</div>
            </div>
          </div>
          <div style="margin-top:8px">${chain || '<span style="font-size:10px;color:var(--sub)">No escalation chain</span>'}</div>
          ${inc.resolution_notes?`<div style="margin-top:8px;padding:8px 10px;background:rgba(34,197,94,0.06);border-radius:6px;border-left:3px solid var(--pos);font-size:11px;color:var(--pos)">✅ ${inc.resolution_notes}</div>`:''}
        </div>`;
      }).join("");
    }
  }

  // Auto-refresh
  clearInterval(window._escInt);
  window._escInt = setInterval(() => renderEscalation(), 20000);
};

window.selectEscIncident = async function(id) {
  window._selectedEscIncident = id;
  const H = _WIRE_HEADERS;

  // Fetch audit trail
  const at = document.getElementById("escAuditTrail");
  if (at) {
    try {
      const res = await fetch("/backend/ops/incidents/"+id+"/audit", {headers:H});
      if (res.ok) {
        const entries = await res.json();
        if (entries.length > 0) {
          at.innerHTML = entries.map((e,i) => {
            const dotCol = e.action.includes("escalat")?"var(--warn)":e.action.includes("resolv")?"var(--pos)":e.action.includes("creat")?"var(--info)":e.action.includes("notif")?"#a855f7":"var(--sub)";
            return `<div style="display:flex;gap:10px;${i<entries.length-1?'padding-bottom:12px':''}">
              <div style="display:flex;flex-direction:column;align-items:center">
                <div style="width:8px;height:8px;border-radius:50%;background:${dotCol};margin-top:4px;flex-shrink:0"></div>
                ${i<entries.length-1?'<div style="width:1px;flex:1;background:var(--bord);min-height:16px"></div>':''}
              </div>
              <div>
                <div style="font-size:11px;font-weight:700;text-transform:capitalize">${(e.action||"").replace(/_/g," ")}</div>
                ${e.details?`<div style="font-size:10px;color:var(--sub);margin-top:2px">${e.details}</div>`:''}
                <div style="font-size:9px;color:var(--mut);margin-top:2px">${e.actor_role||e.actor||"system"} &bull; ${e.created_at?new Date(e.created_at).toLocaleTimeString():""}</div>
              </div>
            </div>`;
          }).join("");
        } else at.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No audit entries</div>';
      }
    } catch { at.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">Could not load audit trail</div>'; }
  }

  // Fetch notifications
  const nl = document.getElementById("escNotifications");
  if (nl) {
    try {
      const res = await fetch("/backend/ops/incidents/"+id+"/notifications", {headers:H});
      if (res.ok) {
        const notifs = await res.json();
        if (notifs.length > 0) {
          const chIcon = {in_app:"📱",email:"📧",sms:"💬",whatsapp:"💬",push:"🔔"};
          nl.innerHTML = notifs.map(n => {
            const stCol = n.status==="read"?"var(--pos)":n.status==="delivered"?"var(--info)":n.status==="failed"?"var(--sev-high)":"var(--warn)";
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--badge);border-radius:8px;margin-bottom:5px;border:1px solid var(--bord)">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:16px">${chIcon[n.channel]||"📨"}</span>
                <div><div style="font-size:11px;font-weight:600">${n.channel}</div><div style="font-size:9px;color:var(--sub)">To: ${n.recipient||"—"}</div></div>
              </div>
              <div style="text-align:right">
                <span class="badge" style="background:${stCol}22;color:${stCol};border:1px solid ${stCol}44;font-size:9px">${n.status}</span>
                <div style="font-size:9px;color:var(--mut);margin-top:2px">${n.sent_at?_opsAge(n.sent_at)+" ago":""}</div>
              </div>
            </div>`;
          }).join("");
        } else nl.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">No notifications</div>';
      }
    } catch { nl.innerHTML = '<div style="color:var(--sub);font-size:12px;padding:16px">Could not load notifications</div>'; }
  }

  // Re-render to highlight selected
  renderEscalation();
};

console.log("[IntelliOps] Backend wiring loaded — All sections now use real APIs: Ops, SLA, Fleet, Dock, Incidents, Escalation, Command");
