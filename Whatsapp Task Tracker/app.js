/* ═══════════════════════════════════════════════════════════════════════
   Vehicle Maintenance Tracker  |  app.js
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────
const COMPANY_COLORS = ['#2d7d5f','#2f6fd6','#8b45c4','#c6473c','#bc7415','#1a7a85'];
const PM_INTERVAL_MI = 5000;
const PM_DUE_WARN_MI = 300;

const CHECKLIST_TEMPLATES = [
  {
    id: 'pre-trip',
    name: 'Pre-Trip Inspection',
    fields: [
      { label: 'Driver', key: 'driver' },
      { label: 'Date', key: 'date', type: 'date' },
      { label: 'Start odometer', key: 'odometerStart', type: 'number' },
      { label: 'End odometer', key: 'odometerEnd', type: 'number' },
    ],
    sections: [
      {
        title: 'Engine & Fluids',
        items: ['Engine oil level','Coolant level','Power steering fluid','Brake fluid','Windshield washer fluid','Fuel level','No fluid leaks under vehicle'],
      },
      {
        title: 'Lights & Signals',
        items: ['Headlights (low & high)','Tail lights','Brake lights','Turn signals (front & rear)','Reverse lights','Hazard lights','Marker lights'],
      },
      {
        title: 'Tires & Wheels',
        items: ['Tire pressure (all 4 + spare)','Tire tread depth OK','No visible damage or bulges','Lug nuts tight','Wheel seals OK'],
      },
      {
        title: 'Brakes & Steering',
        items: ['Brake pedal firm','Parking brake holds','No brake noises','Steering wheel free of play','No shimmy or pull'],
      },
      {
        title: 'Cab & Interior',
        items: ['Seat belt functional','Horn works','Wipers & washer OK','Mirrors clean & adjusted','Dash warning lights clear','Fire extinguisher present','First aid kit present'],
      },
      {
        title: 'Body & Undercarriage',
        items: ['No body damage','Doors & latches secure','Cargo area clean & secure','Frame / chassis no cracks','Exhaust system secure','Driveshaft / CV boots OK'],
      },
    ],
  },
];

// ── Seed data ──────────────────────────────────────────────────────────────
function buildSeedData() {
  const today = new Date();
  const d = (offset = 0) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };

  return {
    companies: [
      { id: 'c1', name: 'Sunrise Transport', color: COMPANY_COLORS[0] },
      { id: 'c2', name: 'Delta Logistics', color: COMPANY_COLORS[1] },
    ],
    vehicles: [
      { id:'v1', companyId:'c1', unit:'T-101', make:'Ford', model:'F-250', year:2020, plate:'ABC-1234', vin:'1FT7X2B66LEA11111', driver:'James Miller', lastServiceOdo:48500, lastServiceDate:d(-45), currentOdo:52100, pmIntervalMi:PM_INTERVAL_MI, status:'ok' },
      { id:'v2', companyId:'c1', unit:'T-102', make:'Chevy', model:'Silverado', year:2019, plate:'XYZ-5678', vin:'1GCRYDED1KZ200002', driver:'Sandra Lee', lastServiceOdo:61200, lastServiceDate:d(-120), currentOdo:66400, pmIntervalMi:PM_INTERVAL_MI, status:'overdue' },
      { id:'v3', companyId:'c1', unit:'T-103', make:'Ram', model:'2500', year:2021, plate:'GHI-9012', vin:'3C6UR5DL5MG300003', driver:'Tom Hayes', lastServiceOdo:29800, lastServiceDate:d(-30), currentOdo:34200, pmIntervalMi:PM_INTERVAL_MI, status:'due' },
      { id:'v4', companyId:'c1', unit:'T-104', make:'Ford', model:'Transit', year:2022, plate:'JKL-3456', vin:'1FTBF2C85NKA40004', driver:'Maria Lopez', lastServiceOdo:15000, lastServiceDate:d(-60), currentOdo:17800, pmIntervalMi:PM_INTERVAL_MI, status:'shop' },
      { id:'v5', companyId:'c2', unit:'D-201', make:'Freightliner', model:'M2 106', year:2018, plate:'TRK-2010', vin:'1FVACXDT8JHJA5555', driver:'Ken Poole', lastServiceOdo:112000, lastServiceDate:d(-20), currentOdo:114500, pmIntervalMi:PM_INTERVAL_MI, status:'ok' },
      { id:'v6', companyId:'c2', unit:'D-202', make:'International', model:'4300', year:2017, plate:'HVY-4020', vin:'1HTMMAANXFH266666', driver:'Diane Wu', lastServiceOdo:95000, lastServiceDate:d(-90), currentOdo:100200, pmIntervalMi:PM_INTERVAL_MI, status:'overdue' },
    ],
    workOrders: [
      { id:'wo1', companyId:'c1', vehicleId:'v2', title:'PM Service – 66k miles overdue', priority:'High', type:'Preventive', assignee:'Shop A', due:d(2), notes:'Oil, filter, rotate tires', completed:false },
      { id:'wo2', companyId:'c1', vehicleId:'v3', title:'PM Service – due this week', priority:'Medium', type:'Preventive', assignee:'Shop A', due:d(5), notes:'Scheduled interval service', completed:false },
      { id:'wo3', companyId:'c1', vehicleId:'v4', title:'Brake replacement – front axle', priority:'High', type:'Repair', assignee:'Shop B', due:d(1), notes:'Pads + rotors both sides', completed:false },
      { id:'wo4', companyId:'c2', vehicleId:'v6', title:'PM Service – 5k miles overdue', priority:'High', type:'Preventive', assignee:'Fleet Mech', due:d(-1), notes:'Full service', completed:false },
      { id:'wo5', companyId:'c2', vehicleId:'v5', title:'Annual DOT inspection', priority:'Low', type:'Inspection', assignee:'Certified Shop', due:d(25), notes:'Schedule with cert shop', completed:false },
    ],
    serviceHistory: [
      { id:'sh1', vehicleId:'v1', date:d(-45), odo:48500, type:'PM Service', cost:320, vendor:'Quick Lube Pro', notes:'Oil, filter, tire rotation, fluid top-off' },
      { id:'sh2', vehicleId:'v1', date:d(-200), odo:41000, type:'Brakes', cost:780, vendor:'Brake Masters', notes:'Front pads and rotors' },
      { id:'sh3', vehicleId:'v2', date:d(-120), odo:61200, type:'PM Service', cost:295, vendor:'Quick Lube Pro', notes:'Standard PM' },
      { id:'sh4', vehicleId:'v3', date:d(-30), odo:29800, type:'PM Service', cost:310, vendor:'Fleet Services Inc', notes:'Oil, filter, belt check' },
      { id:'sh5', vehicleId:'v5', date:d(-20), odo:112000, type:'Oil and filters', cost:180, vendor:'Peterbilt Dealer', notes:'DEF, oil, fuel filter' },
      { id:'sh6', vehicleId:'v6', date:d(-90), odo:95000, type:'PM Service', cost:450, vendor:'International Dealer', notes:'Full PM + alignment' },
    ],
    inspectionLogs: [],
  };
}

// ── State ──────────────────────────────────────────────────────────────────
let state = {};
let activeCompanyId = '';
let activeVehicleId = '';
let activeDetailTab = 'inspection';
let fleetFilter = 'all';
let fleetSearch = '';

// ── Persistence ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'vmt_v4';

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      return;
    }
  } catch (_) { /* ignore */ }
  state = buildSeedData();
  save();
}

function resetData() {
  if (!confirm('Reset all data to demo defaults?')) return;
  localStorage.removeItem(STORAGE_KEY);
  load();
  activeCompanyId = state.companies[0]?.id ?? '';
  activeVehicleId = '';
  navigate('dashboard');
  renderAll();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function fmtMi(n) {
  return Number(n).toLocaleString() + ' mi';
}

function fmtCurrency(n) {
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function miSinceService(v) {
  return (v.currentOdo || 0) - (v.lastServiceOdo || 0);
}

function miToNextPM(v) {
  return (v.pmIntervalMi || PM_INTERVAL_MI) - miSinceService(v);
}

function vehicleRisk(v) {
  if (v.status === 'shop') return 'shop';
  if (v.status === 'down') return 'down';
  const remaining = miToNextPM(v);
  if (remaining < 0) return 'overdue';
  if (remaining < PM_DUE_WARN_MI) return 'due';
  return 'ok';
}

function riskLabel(level) {
  return { ok: 'Ready', due: 'Due soon', overdue: 'Overdue', shop: 'In shop', down: 'Down' }[level] || level;
}

function companyColor(companyId) {
  const c = state.companies.find(x => x.id === companyId);
  return c?.color || COMPANY_COLORS[0];
}

function vehiclesForCompany(companyId) {
  return state.vehicles.filter(v => v.companyId === companyId);
}

function ordersForCompany(companyId) {
  const ids = new Set(vehiclesForCompany(companyId).map(v => v.id));
  return state.workOrders.filter(o => ids.has(o.vehicleId) && !o.completed);
}

function historyForVehicle(vehicleId) {
  return state.serviceHistory
    .filter(h => h.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function logsForVehicle(vehicleId) {
  return (state.inspectionLogs || [])
    .filter(l => l.vehicleId === vehicleId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function el(id) { return document.getElementById(id); }

function clearEl(id) {
  const node = el(id);
  if (node) node.innerHTML = '';
  return node;
}

// ── Router ─────────────────────────────────────────────────────────────────
const PAGES = ['dashboard', 'fleet', 'vehicle', 'orders', 'history'];

function currentPage() {
  const hash = location.hash.slice(1) || 'dashboard';
  return PAGES.includes(hash) ? hash : 'dashboard';
}

function navigate(page, vehicleId) {
  if (vehicleId) activeVehicleId = vehicleId;
  location.hash = page;
}

function showPage(page) {
  PAGES.forEach(p => {
    const sec = el(`page-${p}`);
    if (sec) sec.hidden = p !== page;
  });

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('is-active', a.dataset.page === page);
  });

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'fleet':     renderFleet(); break;
    case 'vehicle':   renderVehicleDetail(); break;
    case 'orders':    renderOrders(); break;
    case 'history':   renderHistory(); break;
  }
}

// ── Company tabs ───────────────────────────────────────────────────────────
function renderCompanyTabs() {
  const nav = el('companyTabs');
  if (!nav) return;
  nav.innerHTML = '';
  state.companies.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'company-tab' + (c.id === activeCompanyId ? ' is-active' : '');
    btn.dataset.company = c.id;
    btn.innerHTML = `<span class="company-dot" style="--company-color:${c.color}"></span>${c.name}`;
    btn.addEventListener('click', () => {
      activeCompanyId = c.id;
      renderCompanyTabs();
      showPage(currentPage());
    });
    nav.appendChild(btn);
  });
}

// ── Orders badge ───────────────────────────────────────────────────────────
function updateOrdersBadge() {
  const badge = el('ordersBadge');
  if (!badge) return;
  const count = ordersForCompany(activeCompanyId).length;
  badge.textContent = count > 0 ? count : '';
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard() {
  const company = state.companies.find(c => c.id === activeCompanyId);
  if (!company) return;

  el('dash-company-title').textContent = company.name;

  const vehicles = vehiclesForCompany(activeCompanyId);
  const orders = ordersForCompany(activeCompanyId);

  const stats = {
    total: vehicles.length,
    ok: vehicles.filter(v => vehicleRisk(v) === 'ok').length,
    shop: vehicles.filter(v => vehicleRisk(v) === 'shop').length,
    overdue: vehicles.filter(v => vehicleRisk(v) === 'overdue').length,
    due: vehicles.filter(v => vehicleRisk(v) === 'due').length,
    openOrders: orders.length,
  };

  // KPI strip
  const kpiEl = clearEl('dashKpis');
  const kpis = [
    { label: 'Total vehicles', value: stats.total, cls: '', sub: 'in fleet' },
    { label: 'Ready', value: stats.ok, cls: 'green', sub: 'vehicles' },
    { label: 'Due soon', value: stats.due, cls: 'amber', sub: 'PM approaching' },
    { label: 'Overdue PM', value: stats.overdue, cls: 'red', sub: 'needs service' },
    { label: 'In shop', value: stats.shop, cls: 'blue', sub: 'vehicles' },
    { label: 'Open orders', value: stats.openOrders, cls: stats.openOrders > 0 ? 'amber' : 'green', sub: 'work orders' },
  ];
  kpis.forEach(k => {
    kpiEl.insertAdjacentHTML('beforeend', `
      <div class="kpi-card">
        <p class="kpi-label">${k.label}</p>
        <p class="kpi-value ${k.cls}">${k.value}</p>
        <p class="kpi-sub">${k.sub}</p>
      </div>`);
  });

  // Attention needed
  const attentionEl = clearEl('dashAttentionList');
  const attn = vehicles.filter(v => ['overdue','due','shop'].includes(vehicleRisk(v)));
  if (attn.length === 0) {
    attentionEl.innerHTML = '<p class="empty">No vehicles need attention.</p>';
  } else {
    attn.slice(0, 6).forEach(v => {
      const risk = vehicleRisk(v);
      const remaining = miToNextPM(v);
      const sub = risk === 'shop'
        ? 'Currently in shop'
        : risk === 'overdue'
          ? `${fmtMi(Math.abs(remaining))} past service interval`
          : `${fmtMi(remaining)} until next PM`;
      const row = document.createElement('button');
      row.className = 'attention-row';
      row.style.borderLeftColor = risk === 'shop' ? 'var(--blue)' : risk === 'due' ? 'var(--amber)' : 'var(--red)';
      row.innerHTML = `
        <div class="attention-row-body">
          <strong>${v.unit} – ${v.make} ${v.model}</strong>
          <small>${sub}</small>
        </div>
        <span class="status-chip" data-level="${risk}">${riskLabel(risk)}</span>`;
      row.addEventListener('click', () => navigate('vehicle', v.id));
      attentionEl.appendChild(row);
    });
  }

  // Upcoming PM (30 days)
  const upcomingEl = clearEl('dashUpcomingList');
  const upcoming = vehicles
    .filter(v => { const r = vehicleRisk(v); return r === 'ok' || r === 'due'; })
    .sort((a, b) => miToNextPM(a) - miToNextPM(b))
    .slice(0, 5);
  if (upcoming.length === 0) {
    upcomingEl.innerHTML = '<p class="empty">No upcoming PM in 30 days.</p>';
  } else {
    upcoming.forEach(v => {
      const remaining = miToNextPM(v);
      const row = document.createElement('button');
      row.className = 'upcoming-row';
      row.innerHTML = `
        <div class="upcoming-row-body">
          <strong>${v.unit} – ${v.make} ${v.model}</strong>
          <small>${fmtMi(remaining)} remaining · Driver: ${v.driver}</small>
        </div>
        <span class="status-chip" data-level="${vehicleRisk(v)}">${fmtMi(remaining)}</span>`;
      row.addEventListener('click', () => navigate('vehicle', v.id));
      upcomingEl.appendChild(row);
    });
  }

  // Open work orders
  const ordersEl = clearEl('dashOrdersList');
  if (orders.length === 0) {
    ordersEl.innerHTML = '<p class="empty">No open work orders.</p>';
  } else {
    orders.slice(0, 5).forEach(o => {
      const v = state.vehicles.find(x => x.id === o.vehicleId);
      ordersEl.insertAdjacentHTML('beforeend', `
        <div class="order-row">
          <div>
            <p class="order-row-title">${o.title}</p>
            <p class="order-row-meta">${v ? v.unit + ' – ' + v.make + ' ' + v.model : ''}</p>
          </div>
          <span class="priority-pill" data-priority="${o.priority}">${o.priority}</span>
          <span class="status-chip" data-level="${o.due < todayISO() ? 'overdue' : 'ok'}">Due ${fmtDate(o.due)}</span>
        </div>`);
    });
  }

  // Fleet snapshot
  const fleetEl = clearEl('dashFleetList');
  vehicles.slice(0, 6).forEach(v => {
    const risk = vehicleRisk(v);
    const color = companyColor(v.companyId);
    const row = document.createElement('button');
    row.className = 'fleet-row';
    row.innerHTML = `
      <div class="fleet-row-body">
        <strong>${v.unit} · ${v.make} ${v.model} ${v.year}</strong>
        <small>Driver: ${v.driver} · ${fmtMi(v.currentOdo)}</small>
      </div>
      <span class="status-chip" data-level="${risk}">${riskLabel(risk)}</span>`;
    row.style.setProperty('--company-color', color);
    row.addEventListener('click', () => navigate('vehicle', v.id));
    fleetEl.appendChild(row);
  });
}

// ── Fleet page ─────────────────────────────────────────────────────────────
function renderFleet() {
  const company = state.companies.find(c => c.id === activeCompanyId);
  if (!company) return;
  el('fleet-company-title').textContent = company.name;

  let vehicles = vehiclesForCompany(activeCompanyId);

  // Search
  const q = fleetSearch.toLowerCase();
  if (q) {
    vehicles = vehicles.filter(v =>
      [v.unit, v.make, v.model, v.plate, v.driver, String(v.year)]
        .some(s => s.toLowerCase().includes(q))
    );
  }

  // Filter
  if (fleetFilter !== 'all') {
    vehicles = vehicles.filter(v => vehicleRisk(v) === fleetFilter);
  }

  const grid = clearEl('vehicleGrid');
  if (vehicles.length === 0) {
    grid.innerHTML = '<p class="empty">No vehicles match the current filter.</p>';
    return;
  }

  vehicles.forEach(v => {
    const risk = vehicleRisk(v);
    const color = companyColor(v.companyId);
    const remaining = miToNextPM(v);
    const card = document.createElement('button');
    card.className = 'vehicle-card';
    card.style.setProperty('--company-color', color);
    card.innerHTML = `
      <div class="vehicle-card-top">
        <div class="vehicle-icon">
          <svg class="icon"><use href="#icon-truck"/></svg>
        </div>
        <div class="vehicle-card-info">
          <strong>${v.unit} – ${v.year} ${v.make} ${v.model}</strong>
          <span>Driver: ${v.driver}</span>
          <span>Plate: ${v.plate}</span>
        </div>
        <span class="status-chip" data-level="${risk}">${riskLabel(risk)}</span>
      </div>
      <div class="vehicle-card-footer">
        <span>${fmtMi(v.currentOdo)} current</span>
        <span>Last service: ${fmtDate(v.lastServiceDate)}</span>
        <span style="color:${remaining < 0 ? 'var(--red)' : remaining < PM_DUE_WARN_MI ? 'var(--amber)' : 'var(--green)'}">
          ${remaining < 0 ? fmtMi(Math.abs(remaining)) + ' overdue' : fmtMi(remaining) + ' to PM'}
        </span>
      </div>`;
    card.addEventListener('click', () => navigate('vehicle', v.id));
    grid.appendChild(card);
  });
}

// ── Vehicle detail ─────────────────────────────────────────────────────────
function renderVehicleDetail() {
  const v = state.vehicles.find(x => x.id === activeVehicleId);
  if (!v) { navigate('fleet'); return; }

  const company = state.companies.find(c => c.id === v.companyId);
  const risk = vehicleRisk(v);
  const color = companyColor(v.companyId);

  el('detailCompany').textContent = company?.name || '';
  el('detailName').textContent = `${v.unit} – ${v.year} ${v.make} ${v.model}`;
  el('detailMeta').textContent = `Plate: ${v.plate}  ·  VIN: ${v.vin}  ·  Driver: ${v.driver}`;

  const badge = el('detailRiskBadge');
  badge.textContent = riskLabel(risk);
  badge.setAttribute('data-level', risk);

  // Metrics
  const metricsEl = clearEl('vehicleMetrics');
  const remaining = miToNextPM(v);
  const pct = Math.min(100, Math.max(0, (miSinceService(v) / v.pmIntervalMi) * 100));
  const metrics = [
    { icon: 'gauge', label: 'Current odometer', value: fmtMi(v.currentOdo), sub: 'miles on vehicle' },
    { icon: 'wrench', label: 'Last service', value: fmtDate(v.lastServiceDate), sub: `at ${fmtMi(v.lastServiceOdo)}` },
    { icon: 'alert', label: 'Miles to next PM', value: remaining < 0 ? fmtMi(Math.abs(remaining)) + ' OVER' : fmtMi(remaining), sub: `${Math.round(pct)}% of interval used`, cls: remaining < 0 ? 'red' : remaining < PM_DUE_WARN_MI ? 'amber' : '' },
    { icon: 'clipboard', label: 'Open orders', value: state.workOrders.filter(o => o.vehicleId === v.id && !o.completed).length, sub: 'work orders' },
  ];
  metrics.forEach(m => {
    metricsEl.insertAdjacentHTML('beforeend', `
      <div class="metric-card">
        <div class="metric-icon" style="background:${color}22; color:${color}">
          <svg class="icon"><use href="#icon-${m.icon}"/></svg>
        </div>
        <p class="metric-label">${m.label}</p>
        <p class="metric-value ${m.cls || ''}">${m.value}</p>
        <p class="metric-sub">${m.sub}</p>
      </div>`);
  });

  // Progress bar
  el('mileageProgressLabel').textContent = `PM interval: ${fmtMi(miSinceService(v))} / ${fmtMi(v.pmIntervalMi)}`;
  const bar = el('mileageProgressBar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct >= 100 ? 'var(--red)' : pct >= 90 ? 'var(--amber)' : 'var(--green)';
  }

  // Specs
  const specEl = clearEl('vehicleSpecs');
  const specs = [
    ['Unit #', v.unit], ['Make', v.make], ['Model', v.model], ['Year', v.year],
    ['Plate', v.plate], ['VIN', v.vin], ['Driver', v.driver],
    ['PM interval', fmtMi(v.pmIntervalMi)],
  ];
  specs.forEach(([dt, dd]) => {
    specEl.insertAdjacentHTML('beforeend', `<div><dt>${dt}</dt><dd>${dd}</dd></div>`);
  });

  // Switch to correct tab panel
  renderDetailTab(activeDetailTab);
}

function renderDetailTab(tab) {
  activeDetailTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.detailTab === tab);
  });
  document.querySelectorAll('[data-tab-panel]').forEach(p => {
    p.hidden = p.dataset.tabPanel !== tab;
  });

  const v = state.vehicles.find(x => x.id === activeVehicleId);
  if (!v) return;

  switch (tab) {
    case 'inspection': renderInspectionChecklist(v); break;
    case 'logs':       renderLogSheet(v); break;
    case 'reports':    renderReports(v); break;
    case 'schedule':   renderServiceHistory(v); break;
  }
}

// ── Checklist ──────────────────────────────────────────────────────────────
let currentChecklistState = {};

function renderInspectionChecklist(v) {
  const tpl = CHECKLIST_TEMPLATES[0];

  // Init blank state if needed
  if (!currentChecklistState.vehicleId || currentChecklistState.vehicleId !== v.id) {
    initBlankChecklist(v, tpl);
  }

  updateChecklistScore(tpl);
  const wrap = clearEl('inspectionChecklist');

  // Header fields
  const fieldsHTML = tpl.fields.map(f => `
    <label>${f.label}
      <input
        data-field="${f.key}"
        type="${f.type || 'text'}"
        value="${currentChecklistState.fields?.[f.key] || ''}"
        placeholder="${f.label}"
      />
    </label>`).join('');

  const sectionsHTML = tpl.sections.map((sec, si) => {
    const itemsHTML = sec.items.map((item, ii) => {
      const key = `${si}-${ii}`;
      const st = currentChecklistState.items?.[key] || 'pending';
      return `
        <div class="inspection-row" data-inspection-state="${st}" data-item-key="${key}">
          <span class="inspection-label">${item}</span>
          <div class="inspection-actions">
            <button class="status-toggle ${st === 'ok' ? 'is-selected' : ''}" data-toggle="ok" data-key="${key}">OK</button>
            <button class="status-toggle repair ${st === 'repair' ? 'is-selected' : ''}" data-toggle="repair" data-key="${key}">Repair</button>
          </div>
          <input class="repair-note" placeholder="Note…" data-note-key="${key}"
            value="${currentChecklistState.notes?.[key] || ''}"
            ${st !== 'repair' ? 'style="display:none"' : ''}
          />
        </div>`;
    }).join('');

    const total = sec.items.length;
    const ok = sec.items.filter((_, ii) => currentChecklistState.items?.[`${si}-${ii}`] === 'ok').length;

    return `
      <div class="inspection-section">
        <div class="inspection-section-header">
          <h4>${sec.title}</h4>
          <span>${ok}/${total} OK</span>
        </div>
        ${itemsHTML}
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="template-title">
      <strong>${tpl.name}</strong>
      <span id="checklistScore"></span>
    </div>
    <div class="inspection-fields">${fieldsHTML}</div>
    <div class="inspection-sections">${sectionsHTML}</div>`;

  updateChecklistScore(tpl);

  // Field inputs
  wrap.querySelectorAll('[data-field]').forEach(inp => {
    inp.addEventListener('input', () => {
      if (!currentChecklistState.fields) currentChecklistState.fields = {};
      currentChecklistState.fields[inp.dataset.field] = inp.value;
    });
  });

  // Toggle buttons
  wrap.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const val = btn.dataset.toggle;
      if (!currentChecklistState.items) currentChecklistState.items = {};
      currentChecklistState.items[key] = val;

      const row = wrap.querySelector(`[data-item-key="${key}"]`);
      row.dataset.inspectionState = val;
      row.querySelectorAll('[data-toggle]').forEach(b => {
        b.classList.toggle('is-selected', b.dataset.toggle === val);
      });
      const noteInput = row.querySelector('[data-note-key]');
      if (noteInput) noteInput.style.display = val === 'repair' ? '' : 'none';

      updateChecklistScore(tpl);
    });
  });

  // Note inputs
  wrap.querySelectorAll('[data-note-key]').forEach(inp => {
    inp.addEventListener('input', () => {
      if (!currentChecklistState.notes) currentChecklistState.notes = {};
      currentChecklistState.notes[inp.dataset.noteKey] = inp.value;
    });
  });
}

function initBlankChecklist(v, tpl) {
  currentChecklistState = {
    vehicleId: v.id,
    fields: { date: todayISO(), driver: v.driver },
    items: {},
    notes: {},
  };
}

function updateChecklistScore(tpl) {
  const total = tpl.sections.reduce((s, sec) => s + sec.items.length, 0);
  const ok = Object.values(currentChecklistState.items || {}).filter(x => x === 'ok').length;
  const repair = Object.values(currentChecklistState.items || {}).filter(x => x === 'repair').length;
  const scoreEl = el('checklistScore');
  if (scoreEl) scoreEl.textContent = `${ok} OK / ${repair} repair / ${total - ok - repair} pending`;
}

function saveInspection(v) {
  const tpl = CHECKLIST_TEMPLATES[0];
  const odo = Number(currentChecklistState.fields?.odometerEnd) || 0;
  const log = {
    id: uid(),
    vehicleId: v.id,
    date: currentChecklistState.fields?.date || todayISO(),
    driver: currentChecklistState.fields?.driver || v.driver,
    odometerStart: Number(currentChecklistState.fields?.odometerStart) || v.currentOdo,
    odometerEnd: odo || v.currentOdo,
    items: { ...currentChecklistState.items },
    notes: { ...currentChecklistState.notes },
    template: tpl.id,
  };
  if (!state.inspectionLogs) state.inspectionLogs = [];
  state.inspectionLogs.push(log);
  if (odo && odo > v.currentOdo) {
    v.currentOdo = odo;
  }
  save();
  alert('Inspection log saved.');
  initBlankChecklist(v, tpl);
  renderVehicleDetail();
}

// ── Log sheet ──────────────────────────────────────────────────────────────
function renderLogSheet(v) {
  const logs = logsForVehicle(v.id);
  const wrap = clearEl('vehicleLogSheet');

  if (logs.length === 0) {
    wrap.innerHTML = '<p class="empty">No inspection logs yet. Save a daily checklist to populate this sheet.</p>';
    return;
  }

  const tpl = CHECKLIST_TEMPLATES[0];
  const allItems = tpl.sections.flatMap(s => s.items);
  const COLS = ['Date','Driver','Start Odo','End Odo','OK','Repair','Pending'];

  let html = '<div class="log-table">';
  html += `<div class="log-row log-row--head">${COLS.map(c => `<span>${c}</span>`).join('')}</div>`;
  logs.forEach(l => {
    const ok = Object.values(l.items || {}).filter(x => x === 'ok').length;
    const repair = Object.values(l.items || {}).filter(x => x === 'repair').length;
    const pending = allItems.length - ok - repair;
    html += `<div class="log-row">
      <span>${fmtDate(l.date)}</span>
      <span>${l.driver}</span>
      <span>${l.odometerStart?.toLocaleString() || '—'}</span>
      <span>${l.odometerEnd?.toLocaleString() || '—'}</span>
      <span>${ok}</span>
      <span>${repair > 0 ? `<strong style="color:var(--red)">${repair}</strong>` : repair}</span>
      <span>${pending}</span>
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

// ── Reports ────────────────────────────────────────────────────────────────
function renderReports(v) {
  const logs = logsForVehicle(v.id);
  const history = historyForVehicle(v.id);
  const totalCost = history.reduce((s, h) => s + (h.cost || 0), 0);

  const summaryEl = clearEl('reportSummary');
  summaryEl.innerHTML = `
    <div class="report-kpi"><span>Inspections</span><strong>${logs.length}</strong></div>
    <div class="report-kpi"><span>Services</span><strong>${history.length}</strong></div>
    <div class="report-kpi"><span>Total spend</span><strong>${fmtCurrency(totalCost)}</strong></div>
    <div class="report-kpi"><span>Open orders</span><strong>${state.workOrders.filter(o => o.vehicleId === v.id && !o.completed).length}</strong></div>`;

  const findingsEl = clearEl('reportFindings');
  const allRepairs = [];
  const tpl = CHECKLIST_TEMPLATES[0];
  logs.forEach(l => {
    Object.entries(l.items || {}).forEach(([key, val]) => {
      if (val === 'repair') {
        const [si, ii] = key.split('-').map(Number);
        const item = tpl.sections[si]?.items[ii] || key;
        allRepairs.push({ item, note: l.notes?.[key] || '', date: l.date, driver: l.driver });
      }
    });
  });

  if (allRepairs.length === 0) {
    findingsEl.innerHTML = '<p class="empty">No repair findings logged yet.</p>';
  } else {
    findingsEl.innerHTML = '<h3 style="font-size:.9rem;color:var(--muted);margin-bottom:4px">Repair findings from inspections</h3>';
    allRepairs.slice(0, 20).forEach(r => {
      findingsEl.insertAdjacentHTML('beforeend', `
        <div class="finding-item">
          <strong>${r.item}</strong>
          <span>${fmtDate(r.date)} · Driver: ${r.driver}</span>
          ${r.note ? `<p>${r.note}</p>` : ''}
        </div>`);
    });
  }
}

// ── Service history (schedule tab) ─────────────────────────────────────────
function renderServiceHistory(v) {
  const history = historyForVehicle(v.id);
  const wrap = clearEl('serviceHistory');
  if (history.length === 0) {
    wrap.innerHTML = '<p class="empty">No service records yet. Log a service to get started.</p>';
    return;
  }
  history.forEach(h => {
    wrap.insertAdjacentHTML('beforeend', `
      <div class="history-item">
        <header>
          <h4>${h.type}</h4>
          <span class="date-pill">${fmtDate(h.date)}</span>
        </header>
        <small>${fmtMi(h.odo)} · ${h.vendor} · ${fmtCurrency(h.cost)}</small>
        ${h.notes ? `<p>${h.notes}</p>` : ''}
      </div>`);
  });
}

// ── Work orders page ───────────────────────────────────────────────────────
function renderOrders() {
  const company = state.companies.find(c => c.id === activeCompanyId);
  const orders = ordersForCompany(activeCompanyId)
    .sort((a, b) => {
      const p = { High: 0, Medium: 1, Low: 2 };
      return (p[a.priority] - p[b.priority]) || a.due.localeCompare(b.due);
    });

  const wrap = clearEl('workOrderList');
  if (orders.length === 0) {
    wrap.innerHTML = `<p class="empty">No open work orders for ${company?.name || 'this company'}.</p>`;
    return;
  }

  orders.forEach(o => {
    const v = state.vehicles.find(x => x.id === o.vehicleId);
    const overdue = o.due < todayISO();
    const card = document.createElement('div');
    card.className = 'order-card';
    card.dataset.priority = o.priority;
    card.innerHTML = `
      <header>
        <div>
          <h3>${o.title}</h3>
          <p>${v ? v.unit + ' – ' + v.make + ' ' + v.model : ''}</p>
        </div>
        <span class="priority-pill" data-priority="${o.priority}">${o.priority}</span>
      </header>
      <div class="order-meta">
        <span>${o.type}</span>
        <span>Assigned: ${o.assignee}</span>
        <span style="color:${overdue ? 'var(--red)' : 'var(--muted)'}">Due: ${fmtDate(o.due)}</span>
      </div>
      ${o.notes ? `<p>${o.notes}</p>` : ''}
      <footer>
        <small>Created for ${company?.name || ''}</small>
        <button class="complete-order-btn" data-order-id="${o.id}">
          <svg class="icon"><use href="#icon-check"/></svg> Mark complete
        </button>
      </footer>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('[data-order-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = state.workOrders.find(x => x.id === btn.dataset.orderId);
      if (o && confirm(`Mark "${o.title}" as complete?`)) {
        o.completed = true;
        save();
        updateOrdersBadge();
        renderOrders();
      }
    });
  });
}

// ── Service history page ───────────────────────────────────────────────────
function renderHistory() {
  const vehicles = vehiclesForCompany(activeCompanyId);
  const vehicleIds = new Set(vehicles.map(v => v.id));
  const history = state.serviceHistory
    .filter(h => vehicleIds.has(h.vehicleId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const wrap = clearEl('allServiceHistory');
  if (history.length === 0) {
    wrap.innerHTML = '<p class="empty">No service records for this company yet.</p>';
    return;
  }

  history.forEach(h => {
    const v = vehicles.find(x => x.id === h.vehicleId);
    wrap.insertAdjacentHTML('beforeend', `
      <div class="history-item">
        <header>
          <h4>${h.type}</h4>
          <span class="date-pill">${fmtDate(h.date)}</span>
        </header>
        <small>${v ? v.unit + ' – ' + v.make + ' ' + v.model : ''} · ${fmtMi(h.odo)} · ${h.vendor} · ${fmtCurrency(h.cost)}</small>
        ${h.notes ? `<p>${h.notes}</p>` : ''}
      </div>`);
  });
}

// ── Dialogs ────────────────────────────────────────────────────────────────
function openDialog(id) {
  const d = el(id);
  if (d) d.showModal();
}

function closeDialog(id) {
  const d = el(id);
  if (d) d.close();
}

function populateVehicleSelect(selectId, companyId, selectedVehicleId) {
  const sel = el(selectId);
  if (!sel) return;
  const vehicles = vehiclesForCompany(companyId || activeCompanyId);
  sel.innerHTML = vehicles.map(v =>
    `<option value="${v.id}" ${v.id === selectedVehicleId ? 'selected' : ''}>${v.unit} – ${v.make} ${v.model}</option>`
  ).join('');
}

function openServiceDialog(vehicleId) {
  populateVehicleSelect('serviceVehicle', activeCompanyId, vehicleId || activeVehicleId);
  el('serviceDate').value = todayISO();
  const v = state.vehicles.find(x => x.id === (vehicleId || activeVehicleId));
  el('serviceOdometer').value = v?.currentOdo || '';
  el('serviceCost').value = '';
  el('serviceVendor').value = '';
  el('serviceNotes').value = '';
  openDialog('serviceDialog');
}

function openOrderDialog(vehicleId) {
  populateVehicleSelect('orderVehicle', activeCompanyId, vehicleId || activeVehicleId);
  el('orderTitle').value = '';
  el('orderDue').value = '';
  el('orderAssignee').value = '';
  el('orderNotes').value = '';
  openDialog('workOrderDialog');
}

function handleServiceSubmit(e) {
  e.preventDefault();
  const vehicleId = el('serviceVehicle').value;
  const odo = Number(el('serviceOdometer').value);
  const record = {
    id: uid(),
    vehicleId,
    date: el('serviceDate').value,
    odo,
    type: el('serviceType').value,
    cost: Number(el('serviceCost').value),
    vendor: el('serviceVendor').value,
    notes: el('serviceNotes').value,
  };
  state.serviceHistory.push(record);

  const v = state.vehicles.find(x => x.id === vehicleId);
  if (v) {
    v.lastServiceDate = record.date;
    v.lastServiceOdo = odo;
    if (odo > v.currentOdo) v.currentOdo = odo;
    v.status = 'ok';
  }
  save();
  closeDialog('serviceDialog');
  renderAll();
}

function handleOrderSubmit(e) {
  e.preventDefault();
  const vehicleId = el('orderVehicle').value;
  const v = state.vehicles.find(x => x.id === vehicleId);
  const order = {
    id: uid(),
    companyId: v?.companyId || activeCompanyId,
    vehicleId,
    title: el('orderTitle').value,
    priority: el('orderPriority').value,
    type: el('orderType').value,
    assignee: el('orderAssignee').value,
    due: el('orderDue').value,
    notes: el('orderNotes').value,
    completed: false,
  };
  state.workOrders.push(order);
  save();
  closeDialog('workOrderDialog');
  renderAll();
}

// ── Company editor ─────────────────────────────────────────────────────────
function openCompanyEditor() {
  const fields = el('companyFields');
  fields.innerHTML = '';
  state.companies.forEach((c, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;';
    row.innerHTML = `
      <span class="company-dot" style="--company-color:${c.color};width:14px;height:14px;border-radius:50%;display:inline-block;background:${c.color}"></span>
      <input type="text" value="${c.name}" data-company-idx="${i}" placeholder="Company name" />
      ${state.companies.length > 1
        ? `<button type="button" class="icon-btn" data-remove-company="${i}" style="width:28px;height:28px;color:var(--red)"><svg class="icon"><use href="#icon-close"/></svg></button>`
        : '<span></span>'}`;
    fields.appendChild(row);
  });

  fields.querySelectorAll('[data-remove-company]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeCompany);
      state.companies.splice(idx, 1);
      if (activeCompanyId === btn.dataset.companyId) activeCompanyId = state.companies[0]?.id || '';
      openCompanyEditor();
    });
  });

  openDialog('companyDialog');
}

el('addCompanyButton')?.addEventListener('click', () => {
  const nextColor = COMPANY_COLORS[state.companies.length % COMPANY_COLORS.length];
  state.companies.push({ id: uid(), name: `Company ${state.companies.length + 1}`, color: nextColor });
  openCompanyEditor();
});

el('companyForm')?.addEventListener('submit', e => {
  e.preventDefault();
  document.querySelectorAll('[data-company-idx]').forEach(inp => {
    const idx = Number(inp.dataset.companyIdx);
    if (state.companies[idx]) state.companies[idx].name = inp.value.trim() || state.companies[idx].name;
  });
  save();
  closeDialog('companyDialog');
  renderAll();
});

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportOrders() {
  const orders = ordersForCompany(activeCompanyId);
  const rows = [['ID','Vehicle','Title','Priority','Type','Assignee','Due','Notes']];
  orders.forEach(o => {
    const v = state.vehicles.find(x => x.id === o.vehicleId);
    rows.push([o.id, v ? v.unit : '', o.title, o.priority, o.type, o.assignee, o.due, o.notes]);
  });
  downloadCSV('work-orders.csv', rows);
}

function exportInspection() {
  const v = state.vehicles.find(x => x.id === activeVehicleId);
  if (!v) return;
  const logs = logsForVehicle(v.id);
  const tpl = CHECKLIST_TEMPLATES[0];
  const allItems = tpl.sections.flatMap(s => s.items);
  const rows = [['Date','Driver','Start Odo','End Odo','OK','Repair','Pending']];
  logs.forEach(l => {
    const ok = Object.values(l.items || {}).filter(x => x === 'ok').length;
    const repair = Object.values(l.items || {}).filter(x => x === 'repair').length;
    rows.push([l.date, l.driver, l.odometerStart, l.odometerEnd, ok, repair, allItems.length - ok - repair]);
  });
  downloadCSV(`inspection-${v.unit}.csv`, rows);
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename;
  a.click();
}

// ── renderAll ──────────────────────────────────────────────────────────────
function renderAll() {
  renderCompanyTabs();
  updateOrdersBadge();
  showPage(currentPage());
}

// ── Wire up all static buttons ─────────────────────────────────────────────
function wireButtons() {
  // Reset
  el('resetButton')?.addEventListener('click', resetData);

  // Company editor
  el('editCompaniesButton')?.addEventListener('click', openCompanyEditor);

  // Dialog close buttons
  document.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('dialog')?.close();
    });
  });

  // Service form
  el('serviceForm')?.addEventListener('submit', handleServiceSubmit);
  el('workOrderForm')?.addEventListener('submit', handleOrderSubmit);

  // Dashboard buttons
  el('dash-log-service')?.addEventListener('click', () => openServiceDialog(null));
  el('dash-new-order')?.addEventListener('click', () => openOrderDialog(null));

  // Fleet page buttons
  el('fleet-new-order')?.addEventListener('click', () => openOrderDialog(null));
  el('fleetSearch')?.addEventListener('input', e => { fleetSearch = e.target.value; renderFleet(); });

  // Fleet filters
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      fleetFilter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderFleet();
    });
  });

  // Vehicle detail buttons
  el('vehicleBackBtn')?.addEventListener('click', () => navigate('fleet'));
  el('detail-log-service')?.addEventListener('click', () => openServiceDialog(activeVehicleId));
  el('detail-new-order')?.addEventListener('click', () => openOrderDialog(activeVehicleId));
  el('saveInspectionButton')?.addEventListener('click', () => {
    const v = state.vehicles.find(x => x.id === activeVehicleId);
    if (v) saveInspection(v);
  });
  el('newDailyInspectionButton')?.addEventListener('click', () => {
    const v = state.vehicles.find(x => x.id === activeVehicleId);
    if (v) { initBlankChecklist(v, CHECKLIST_TEMPLATES[0]); renderInspectionChecklist(v); }
  });
  el('exportInspectionButton')?.addEventListener('click', exportInspection);

  // Detail tabs
  document.querySelectorAll('[data-detail-tab]').forEach(btn => {
    btn.addEventListener('click', () => renderDetailTab(btn.dataset.detailTab));
  });

  // Orders page
  el('orders-new')?.addEventListener('click', () => openOrderDialog(null));
  el('orders-export')?.addEventListener('click', exportOrders);

  // History page
  el('history-log-service')?.addEventListener('click', () => openServiceDialog(null));
}

// ── Hash router ────────────────────────────────────────────────────────────
window.addEventListener('hashchange', () => showPage(currentPage()));

// ── Boot ───────────────────────────────────────────────────────────────────
(function init() {
  load();
  activeCompanyId = state.companies[0]?.id || '';
  wireButtons();
  renderAll();
})();
