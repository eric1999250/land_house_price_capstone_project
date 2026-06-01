// ============================================================
// SECTOR DASHBOARD — pages/dashboard/sector.js
// UPDATED: Same topbar + collapsible sidebar format as admin/district
// ============================================================
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const API = 'http://127.0.0.1:5000';

function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem('lpe_user');
    if (!s) { router.replace('/'); return; }
    let u;
    try { u = JSON.parse(s); } catch { router.replace('/'); return; }
    if (u.role !== 'sector_land_officer') {
      const map = { system_admin: '/dashboard/admin', buyer_seller: '/dashboard/buyer', district_land_officer: '/dashboard/district', notary: '/dashboard/notary' };
      router.replace(map[u.role] || '/'); return;
    }
    setUser(u);
  }, []);
  return { user };
}

const validatePassword = (password, fullName, email) => {
  if (password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password)) return { ok: false, msg: 'Password must contain at least one uppercase letter.' };
  if (!/[a-z]/.test(password)) return { ok: false, msg: 'Password must contain at least one lowercase letter.' };
  if (!/[0-9]/.test(password)) return { ok: false, msg: 'Password must contain at least one number.' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) return { ok: false, msg: 'Password must contain at least one special character.' };
  if (fullName) { const parts = fullName.toLowerCase().split(/\s+/).filter(p => p.length >= 3); for (const part of parts) if (password.toLowerCase().includes(part)) return { ok: false, msg: 'Password must not contain your name.' }; }
  if (email) { const u = email.split('@')[0].toLowerCase(); if (u.length >= 3 && password.toLowerCase().includes(u)) return { ok: false, msg: 'Password must not contain your email.' }; }
  return { ok: true, msg: '' };
};

const fmt = n => Math.round(n).toLocaleString('en-US') + ' RWF';
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const calcTax = p => p > 5_000_000 ? (p - 5_000_000) * 0.025 : 0;

// ── Icons ────────────────────────────────────────────────────
const Ic = {
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Input: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Shield: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  Records: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Report: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Map: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
  Logout: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Spin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Refresh: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  Search: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Download: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  User: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  ChevDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Menu: () => (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
      <path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor"/>
      <rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor"/>
      <rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor"/>
    </svg>
  ),
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'input', label: 'Input Land Data', icon: 'Input' },
  { id: 'verify', label: 'Verify Land Info', icon: 'Map' },
  { id: 'mutations', label: 'Mutations', icon: 'Shield' },
  { id: 'records', label: 'Recorded Deeds', icon: 'Records' },
  { id: 'pricechek', label: 'Price Check', icon: 'Search' },
  { id: 'reports', label: 'Reports', icon: 'Report' },
];

// ── Alerts ──────────────────────────────────────────────────
function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const addAlert = (message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setAlerts(prev => [...prev, { id, message, type }]);
    if (duration > 0) setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), duration);
  };
  const removeAlert = id => setAlerts(prev => prev.filter(a => a.id !== id));
  return { alerts, addAlert, removeAlert };
}

function ToastContainer({ alerts, removeAlert }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {alerts.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'white', boxShadow: '0 8px 24px rgba(13,148,136,.18)', borderLeft: `4px solid ${a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b'}`, animation: 'fadeUp .3s ease' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.type === 'success' ? 'rgba(13,148,136,.1)' : a.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b', flexShrink: 0 }}>
            {a.type === 'success'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              : a.type === 'error'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>}
          </span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: '"Times New Roman",Times,serif', color: '#0c1a19' }}>{a.message}</span>
          <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────
function Sidebar({ active, setActive, sidebarOpen }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <nav className="sb-nav">
        <div className="sb-section">Navigation</div>
        {NAV.map(n => {
          const IconComp = Ic[n.icon];
          return (
            <button key={n.id} className={`sb-item ${active === n.id ? 'active' : ''}`} onClick={() => setActive(n.id)}>
              <span className="sb-icon">{IconComp && <IconComp />}</span>
              <span className="sb-label">{n.label}</span>
              {active === n.id && <span className="sb-pip" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Dashboard ─────────────────────────────────────────────
function ViewDashboard({ setActive, stats }) {
  return (
    <div className="view">
      <div className="stats-grid">
        {[
          { label: 'Parcels Entered', value: stats.entered || 0, color: '#0d9488', sub: 'registered', target: 'input' },
          { label: 'Parcels Verified', value: stats.verified || 0, color: '#0891b2', sub: 'confirmed', target: 'verify' },
          { label: 'Pending Mutations', value: stats.pending || 0, color: '#f59e0b', sub: 'awaiting review', target: 'mutations' },
          { label: 'Approved Mutations', value: stats.approved || 0, color: '#22c55e', sub: 'completed', target: 'records' },
        ].map(s => (
          <div key={s.label} className="stat-card clickable" style={{ '--c': s.color, cursor: 'pointer' }} onClick={() => setActive(s.target)}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
            </div>
        ))}
      </div>
      <div className="section-label">QUICK ACTIONS</div>
      <div className="qa-grid">
        {[
          { label: 'Input Land Data', desc: 'Register new parcel', id: 'input', color: '#0d9488' },
          { label: 'Verify Land Info', desc: 'Search & verify UPI', id: 'verify', color: '#0891b2' },
          { label: 'Mutations', desc: 'Review land transfer mutations', id: 'mutations', color: '#f59e0b' },
          { label: 'Recorded Deeds', desc: 'All approved land transfers', id: 'records', color: '#22c55e' },
          { label: 'Reports', desc: 'Generate & send to district', id: 'reports', color: '#7c3aed' },
        ].map(q => (
          <button key={q.id} className="qa-card" onClick={() => setActive(q.id)}>
            <div className="qa-dot" style={{ background: q.color }} />
            <div className="qa-label">{q.label}</div>
            <div className="qa-desc">{q.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Input Land Data ───────────────────────────────────────
function ViewInput({ user, addAlert }) {
  const [form, setForm] = useState({ upi: '', province_id: '', district_id: '', sector_id: '', cell_id: '', village_id: '', x: '', y: '', area_m2: '', zoning: '', zoning_percentage: '', sentlement: '', sentlement_percentage: '', land_use: '', minimum_value_per_sqm: '', weighted_average_value_per_sqm: '', maximum_value_per_sqm: '' });
  const [loading, setLoading] = useState(false);
  const h = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const r = await fetch(`${API}/sector/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, user_id: user?.id }) });
      const d = await r.json();
      if (d.success) {
        addAlert('Land parcel data submitted successfully!', 'success');
        setForm({ upi: '', province_id: '', district_id: '', sector_id: '', cell_id: '', village_id: '', x: '', y: '', area_m2: '', zoning: '', zoning_percentage: '', sentlement: '', sentlement_percentage: '', land_use: '', minimum_value_per_sqm: '', weighted_average_value_per_sqm: '', maximum_value_per_sqm: '' });
      } else addAlert(d.message || 'Submission failed.', 'error');
    } catch { addAlert('Cannot connect to server.', 'error'); }
    setLoading(false);
  }

  const fields = [
    { name: 'upi', label: 'UPI *', placeholder: 'xx/xx/xx/xx/xxxx', req: true },
    { name: 'province_id', label: 'Province ID *', placeholder: 'e.g. 2', req: true },
    { name: 'district_id', label: 'District ID *', placeholder: 'e.g. 4', req: true },
    { name: 'sector_id', label: 'Sector ID *', placeholder: 'e.g. 7', req: true },
    { name: 'cell_id', label: 'Cell ID', placeholder: 'e.g. 2', req: false },
    { name: 'village_id', label: 'Village ID', placeholder: 'e.g. 3334', req: false },
    { name: 'x', label: 'X Coordinate', placeholder: '30.0619', req: false },
    { name: 'y', label: 'Y Coordinate', placeholder: '-1.9441', req: false },
    { name: 'area_m2', label: 'Area (m²) *', placeholder: '500', req: true },
    { name: 'zoning', label: 'Zoning', placeholder: 'R1', req: false },
    { name: 'zoning_percentage', label: 'Zoning %', placeholder: '80', req: false },
    { name: 'sentlement', label: 'Settlement Type', placeholder: 'Urban', req: false },
    { name: 'sentlement_percentage', label: 'Settlement %', placeholder: '60', req: false },
    { name: 'land_use', label: 'Land Use *', placeholder: 'Residential', req: true },
    { name: 'minimum_value_per_sqm', label: 'Min Value/m²', placeholder: '5000', req: false },
    { name: 'weighted_average_value_per_sqm', label: 'Avg Value/m²', placeholder: '8000', req: false },
    { name: 'maximum_value_per_sqm', label: 'Max Value/m²', placeholder: '12000', req: false },
  ];

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Input /> Input Land Data</div>
        <div style={{ padding: '18px 20px' }}>
          <div className="form-grid">
            {fields.map(f => (
              <div key={f.name} className="form-group">
                <label className="form-label">{f.label}</label>
                <input className="f-inp" name={f.name} value={form[f.name]} onChange={h} placeholder={f.placeholder} required={f.req} />
              </div>
            ))}
          </div>
          <button className="btn-pred" onClick={submit} disabled={loading}>
            {loading ? <><Ic.Spin /> Submitting…</> : <><Ic.Input /> Submit Land Data</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verify Land Info ──────────────────────────────────────
function ViewVerify({ user, addAlert }) {
  const [upi, setUpi] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e.preventDefault(); setData(null); setLoading(true);
    try {
      const r = await fetch(`${API}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upi.trim() }) });
      const d = await r.json();
      if (d.success) setData(d.data);
      else addAlert(d.message || 'Not found.', 'error');
    } catch { addAlert('Cannot connect.', 'error'); }
    setLoading(false);
  }

  async function markVerified() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/sector/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: data?.UPI || upi, user_id: user?.id }) });
      const d = await r.json();
      if (d.success) { addAlert('Parcel marked as verified!', 'success'); setData(null); setUpi(''); }
      else addAlert('Error: ' + d.message, 'error');
    } catch { addAlert('Cannot connect.', 'error'); }
    setLoading(false);
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Map /> Search & Verify Land Information</div>
        <div className="s-row">
          <input className="s-inp" value={upi} onChange={e => setUpi(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(e)} placeholder="e.g. xx/xx/xx/xx/xxxx" />
          <button className="btn-p" onClick={search} disabled={loading}>
            <Ic.Search /> {loading ? <><Ic.Spin /> …</> : 'Search'}
          </button>
        </div>
      </div>
      {data && (
        <div className="card">
          <div className="card-hd"><Ic.Info /> Parcel: {data.UPI}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, padding: '18px 20px' }}>
            {Object.entries(data).filter(([k]) => k !== '_source').map(([k, v]) => (
              <div key={k} style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{String(v) || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, padding: '0 20px 20px' }}>
            <button className="btn-p" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }} onClick={markVerified} disabled={loading}>
              <Ic.Check /> Mark as Verified
            </button>
            <button className="btn-ghost" onClick={() => { setData(null); setUpi(''); }}>
              <Ic.X /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mutations ─────────────────────────────────────────────
function ViewMutations({ addAlert }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (d.success) setTxs(d.transactions || []);
    } catch { if (!silent) setTxs([]); }
    if (!silent) setLoading(false);
  }

  async function loadDocuments(transactionId) {
    setDocsLoading(true);
    setDocsData(null);
    try {
      const r = await fetch(`${API}/transaction/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      const d = await r.json();
      if (d.success) setDocsData(d);
      else addAlert(d.message || 'Failed to load documents', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setDocsLoading(false);
  }

  useEffect(() => { load(false); }, []);

  useEffect(() => {
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = s => ({ approved: '#10b981', pending: '#f59e0b', rejected: '#ef4444' }[s] || '#94a3b8');
  const filtered = txs.filter(t => filter === 'all' ? true : t.status === filter);

  return (
    <div className="view">
      {/* Documents Modal */}
      {docsModal && (
        <div className="m-overlay" onClick={() => { setDocsModal(null); setDocsData(null); }}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0, padding: '20px 24px 0', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Transaction Documents</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Ref: {docsModal.reference} · UPI: {docsModal.upi}</div>
              </div>
              <button className="x-close-btn" onClick={() => { setDocsModal(null); setDocsData(null); }}>✕</button>
            </div>
            <div style={{ overflowY: 'scroll', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 24px 16px' }}>
              {docsLoading && <div style={{ padding: 30, textAlign: 'center', color: '#4d7c77' }}>Loading documents...</div>}
              {!docsLoading && docsData && (
                <>
                  {docsData.notary_info && (
                    <div style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', marginBottom: 8 }}>Notary Information</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{docsData.notary_info.notary_name}</div>
                      <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 4 }}>
                        {docsData.notary_info.notary_type && <span>Type: {docsData.notary_info.notary_type}</span>}
                        {docsData.notary_info.sector_name && <span> · Sector: {docsData.notary_info.sector_name}</span>}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', marginBottom: 10, position: 'sticky', top: 0, background: 'white', zIndex: 9, paddingTop: 4, paddingBottom: 8 }}>
                    Documents ({docsData.total || 0})
                  </div>
                  {(!docsData.documents || docsData.documents.length === 0) && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: 13 }}>No documents found for this transaction.</div>
                  )}
                  {docsData.documents && docsData.documents.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: doc.source === 'notary' ? '#f0fdfa' : '#eff6ff', border: `1px solid ${doc.source === 'notary' ? '#ccf2ee' : '#bfdbfe'}`, borderRadius: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: doc.source === 'notary' ? '#0d9488' : '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: 12 }}>📄</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                          {doc.doc_type === 'signed_agreement' ? 'Notarized Document' : doc.doc_type?.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>{doc.original_name || doc.file_path}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: doc.source === 'notary' ? 'rgba(13,148,136,.1)' : 'rgba(8,145,178,.1)', color: doc.source === 'notary' ? '#0d9488' : '#0891b2' }}>
                          {doc.source === 'notary' ? 'Notary' : 'Buyer'}
                        </span>
                        {doc.verified && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(22,163,74,.1)', color: '#16a34a' }}>✓ Verified</span>}
                        {doc.file_path && (
                          <a href={`${API}/uploads/${doc.file_path}`} target="_blank" rel="noopener noreferrer" className="tbl-btn" style={{ background: 'rgba(8,145,178,.1)', color: '#0891b2', textDecoration: 'none' }}>View</a>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Shield /> Mutations</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.15)', borderRadius: 40, padding: 3 }}>
              {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)} style={{ padding: '5px 14px', borderRadius: 40, border: 'none', background: filter === v ? 'white' : 'transparent', color: filter === v ? '#0d9488' : 'rgba(255,255,255,.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', transition: 'all .15s' }}>{l}</button>
              ))}
            </div>
            <button onClick={load} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}><Ic.Refresh /></button>
          </div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No {filter === 'all' ? '' : filter} mutations.</div>}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th><th>UPI</th><th>Buyer</th><th>Seller</th>
                  <th>Price (RWF)</th><th>Status</th><th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 12 }}>{t.reference}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.upi}</td>
                    <td>{t.buyer_name}</td>
                    <td>{t.seller_name}</td>
                    <td style={{ fontWeight: 700 }}>{Number(t.agreed_price || 0).toLocaleString()}</td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, color: statusColor(t.status) }}>● {t.status}</span></td>
                    <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(t.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {t.status === 'pending' && (
                          <button className="btn-p" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                            {selected?.id === t.id ? 'Close' : 'Review'}
                          </button>
                        )}
                        {/* View Docs button - INSIDE the table cell */}
                        <button 
                          className="tbl-btn" 
                          style={{ background: 'rgba(8,145,178,.1)', color: '#0891b2' }}
                          onClick={() => { setDocsModal(t); loadDocuments(t.id); }}
                        >
                          View Docs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected && (
          <div style={{ borderTop: '1px solid var(--g200)', padding: '16px 20px', background: '#fafffe' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#0d9488' }}>
              Reviewing: <span style={{ fontFamily: 'monospace' }}>{selected.reference}</span> — {selected.upi}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                ['Seller', selected.seller_name],
                ['Buyer', selected.buyer_name],
                ['Agreed Price', Number(selected.agreed_price || 0).toLocaleString() + ' RWF'],
                ['Status', selected.status],
                ['Date', fmtDate(selected.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase' }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v || '—'}</div>
                </div>
              ))}
            </div>
            <button className="btn-ghost" onClick={() => setSelected(null)}>Close Review</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Recorded Deeds ────────────────────────────────────────
function ViewRecords({ addAlert }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadRecords(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (d.success) setRecords((d.transactions || []).filter(t => t.status === 'approved'));
    } catch { if (!silent) addAlert('Cannot connect', 'error'); }
    if (!silent) setLoading(false);
  }

  useEffect(() => { loadRecords(false); }, []);

  useEffect(() => {
    const interval = setInterval(() => loadRecords(true), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Records /> Recorded Land Transfers ({records.length})</div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && records.length === 0 && <div className="empty-state">No recorded deeds yet.</div>}
        {!loading && records.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Reference</th><th>UPI</th><th>Buyer</th><th>Seller</th><th>Price (RWF)</th><th>Tax</th><th>Date</th></tr></thead>
              <tbody>
                {records.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 12 }}>{t.reference}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.upi}</td>
                    <td>{t.buyer_name}</td>
                    <td>{t.seller_name}</td>
                    <td style={{ fontWeight: 700 }}>{Number(t.agreed_price || 0).toLocaleString()}</td>
                    <td style={{ color: calcTax(t.agreed_price) > 0 ? '#f59e0b' : '#10b981', fontSize: 12 }}>
                      {calcTax(t.agreed_price) > 0 ? fmt(calcTax(t.agreed_price)) : 'None'}
                    </td>
                    <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Price Check ───────────────────────────────────────────
// ── Price Check ───────────────────────────────────────────
function ViewPriceCheck({ addAlert }) {
  const [upi, setUpi] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function check(e) {
    e.preventDefault();
    if (!upi.trim()) { addAlert('Please enter a UPI', 'error'); return; }
    if (!agreedPrice || isNaN(agreedPrice)) { addAlert('Please enter a valid agreed price', 'error'); return; }
    setResult(null); setLoading(true);
    try {
      const r = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi: upi.trim() }),
      });
      const d = await r.json();
      if (!d.success) { addAlert(d.message || 'Prediction failed', 'error'); setLoading(false); return; }

      const minP = parseFloat(d.min_price);
      const avgP = parseFloat(d.avg_price);
      const maxP = parseFloat(d.max_price);
      const agreed = parseFloat(agreedPrice);

      // Find the greater range
      const lowerRange = avgP - minP;
      const upperRange = maxP - avgP;
      const greaterIsUpper = upperRange >= lowerRange;

      // Valid range based on greater side
      const validLow  = greaterIsUpper ? avgP : minP;
      const validHigh = greaterIsUpper ? maxP : avgP;

      // Price must never be below min or above max
      const belowMin = agreed < minP;
      const aboveMax = agreed > maxP;
      const outOfValidRange = agreed < validLow || agreed > validHigh;
      const inRange = !belowMin && !aboveMax && !outOfValidRange;

      const diff = agreed - avgP;
      const diffPct = ((diff / avgP) * 100).toFixed(1);

      let verdict = '';
      if (belowMin) verdict = `Price is below the minimum allowed value of ${fmt(minP)}.`;
      else if (aboveMax) verdict = `Price is above the maximum allowed value of ${fmt(maxP)}.`;
      else if (outOfValidRange) {
        if (greaterIsUpper) verdict = `The greater price range is ${fmt(avgP)} – ${fmt(maxP)}. Price must be within this range.`;
        else verdict = `The greater price range is ${fmt(minP)} – ${fmt(avgP)}. Price must be within this range.`;
      }

      setResult({ minP, avgP, maxP, agreed, inRange, diff, diffPct, verdict, validLow, validHigh, greaterIsUpper, upi: upi.trim(), land: d.land || {} });
    } catch { addAlert('Cannot connect to server', 'error'); }
    setLoading(false);
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Search /> UPI Price Verification</div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ background: 'var(--teal-l)', border: '1px solid var(--g200)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0d9488', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.Info />
            Enter the UPI and the agreed price. The system checks if the price falls within the greater of the two ML ranges (Min→Avg or Avg→Max), and must not exceed Min or Max bounds.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">UPI *</label>
              <input className="f-inp" value={upi} onChange={e => setUpi(e.target.value)} placeholder="e.g. xx/xx/xx/xx/xxxx" onKeyDown={e => e.key === 'Enter' && check(e)} />
            </div>
            <div className="form-group">
              <label className="form-label">Agreed Price (RWF) *</label>
              <input className="f-inp" type="number" value={agreedPrice} onChange={e => setAgreedPrice(e.target.value)} placeholder="e.g. 12000000" onKeyDown={e => e.key === 'Enter' && check(e)} />
            </div>
          </div>
          <button className="btn-pred" onClick={check} disabled={loading}>
            {loading ? <><Ic.Spin /> Predicting…</> : <><Ic.Search /> Check Price</>}
          </button>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-hd">
            {result.inRange ? <Ic.Check /> : <Ic.X />}
            {result.inRange ? 'Price is Within Acceptable Range' : 'Price is Outside Acceptable Range'}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 14 }}>{result.upi}</div>

            {/* 3 ML prices + agreed price centered below */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Min Price', value: fmt(result.minP), color: '#10b981', sub: 'lower bound' },
                  { label: 'Avg Price', value: fmt(result.avgP), color: '#0891b2', sub: 'ML average' },
                  { label: 'Max Price', value: fmt(result.maxP), color: '#7c3aed', sub: 'upper bound' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--teal-l)', borderTop: `3px solid ${c.color}`, border: '1px solid var(--g200)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>{c.sub}</div>
                  </div>
                ))}
              </div>
              {/* Agreed price centered below */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: result.inRange ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `2px solid ${result.inRange ? '#22c55e' : '#ef4444'}`, borderRadius: 12, padding: '14px 32px', textAlign: 'center', minWidth: 220 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Agreed Price</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: result.inRange ? '#15803d' : '#dc2626' }}>{fmt(result.agreed)}</div>
                  <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>{result.diff >= 0 ? `+${result.diffPct}%` : `${result.diffPct}%`} vs avg</div>
                </div>
              </div>
            </div>

            {/* Greater range indicator */}
            <div style={{ background: 'rgba(8,145,178,.06)', border: '1px solid rgba(8,145,178,.2)', borderRadius: 12, padding: '12px 16px', fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#0891b2', marginBottom: 6, fontSize: 13 }}>Range Analysis</div>
              <div style={{ fontSize: 12, color: '#4d7c77' }}>
                Lower range (Min→Avg): <strong>{fmt(result.avgP - result.minP)}</strong> &nbsp;|&nbsp;
                Upper range (Avg→Max): <strong>{fmt(result.maxP - result.avgP)}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 600, marginTop: 4 }}>
                ▶ Valid price range: <strong>{fmt(result.validLow)} – {fmt(result.validHigh)}</strong>
                &nbsp;({result.greaterIsUpper ? 'Avg→Max is greater' : 'Min→Avg is greater'})
              </div>
            </div>

            {/* Verdict */}
            <div style={{ background: result.inRange ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)', border: `1px solid ${result.inRange ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22 }}>{result.inRange ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: result.inRange ? '#15803d' : '#dc2626', marginBottom: 4 }}>
                  {result.inRange ? 'Transaction Price Verified' : 'Price Discrepancy Detected'}
                </div>
                <div style={{ fontSize: 13, color: result.inRange ? '#166534' : '#991b1b' }}>
                  {result.inRange
                    ? `The agreed price of ${fmt(result.agreed)} falls within the valid range of ${fmt(result.validLow)} – ${fmt(result.validHigh)}. This transaction follows system rules.`
                    : result.verdict}
                </div>
              </div>
            </div>

            {/* Land details */}
            {Object.keys(result.land).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Land Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8 }}>
                  {Object.entries(result.land).map(([k, v]) => (
                    <div key={k} style={{ background: 'white', border: '1px solid var(--g200)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px' }}>{k.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{String(v) || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setResult(null); setUpi(''); setAgreedPrice(''); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', fontSize: 14, fontWeight: 700, fontFamily: '"Times New Roman",Times,serif', background: 'linear-gradient(135deg,#0f172a,#0d9488)', color: 'white', border: 'none', borderRadius: 'var(--rl)', cursor: 'pointer', transition: 'all .22s', letterSpacing: '.3px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              ↺ Clear & Check Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────
function ViewReports({ user, addAlert }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [existingReport, setExistingReport] = useState(null);
  const [sent, setSent] = useState(false);
 
  async function generate(e) {
    e.preventDefault();
    setReport(null);
    setExistingReport(null);
 
    if (!startDate || !endDate) {
      addAlert('Please select both start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      addAlert('Start date must be before end date', 'error');
      return;
    }
 
    setLoading(true);
    const body = { user_id: user?.id, start_date: startDate, end_date: endDate };
 
    try {
      const checkR = await fetch(`${API}/sector/report/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const checkD = await checkR.json();
 
      if (checkD.success && checkD.exists) {
        setExistingReport(checkD.existing_report);
        addAlert(`Report already exists for this date range: ${checkD.existing_report.reference}`, 'warning');
        setLoading(false);
        return;
      }
 
      const r = await fetch(`${API}/sector/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setReport(d);
        addAlert(`Report generated: ${d.reference}`, 'success');
      } else addAlert(d.message || 'Failed to generate report', 'error');
    } catch { addAlert('Cannot connect to server', 'error'); }
    setLoading(false);
  }
 
  async function sendToDistrict() {
    if (!report) return;
    try {
      const r = await fetch(`${API}/sector/report/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_ref: report.reference, user_id: user?.id }),
      });
      const d = await r.json();
      if (d.success) {
        addAlert('Report sent to District!', 'success');
        setSent(true);
        setTimeout(() => {
          setReport(null);
          setStartDate('');
          setEndDate('');
          setSent(false);
        }, 2000);
      } else addAlert(d.message || 'Send failed', 'error');
    } catch { addAlert('Send failed', 'error'); }
  }
 
  function download() {
    if (!report) return;
    const blob = new Blob([
      `SECTOR REPORT\n=============\nRef: ${report.reference}\n` +
      `Officer: ${user?.name}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\n${report.content || ''}`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
 
  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Report /> Generate Report</div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{
            background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0d9488',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Ic.Info />
            Sector reports cover all land parcels entered, mutations, and pending items within the selected date range. Reports are sent to your District Land Officer.
          </div>
 
          {/* Date range only */}
          <div style={{
            background: 'var(--teal-l)', border: '1px solid var(--g200)',
            borderRadius: 12, padding: '16px', marginBottom: 16
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#0d9488' }}>
              Select Date Range *
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4d7c77', marginBottom: 4, display: 'block' }}>
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--g200)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#0c1a19' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4d7c77', marginBottom: 4, display: 'block' }}>
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--g200)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'white', color: '#0c1a19' }}
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
              All sector activities (parcels entered, parcels verified, mutations, pending items) within this range will be included in one comprehensive report.
            </div>
          </div>
 
          <button className="btn-pred" onClick={generate} disabled={loading || !startDate || !endDate}>
            {loading ? <><Ic.Spin /> Generating…</> : <><Ic.Report /> Generate Full Report</>}
          </button>
        </div>
      </div>
 
      {/* Existing report warning */}
      {existingReport && (
        <div className="card" style={{ border: '1.5px solid #f59e0b' }}>
          <div className="card-hd" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <Ic.Info /> Report Already Exists
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 10 }}>
              A report was already generated for <strong>{startDate}</strong> to <strong>{endDate}</strong>.
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
              {existingReport.reference}
            </div>
            <div style={{ fontSize: 11, color: '#b45309', marginBottom: 14 }}>
              Generated: {existingReport.generated_at
                ? new Date(existingReport.generated_at).toLocaleString('en-GB') : '—'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" onClick={() => { setReport(existingReport); setExistingReport(null); }}>
                View Existing Report
              </button>
              <button className="btn-p" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                onClick={() => setExistingReport(null)}>
                Generate New Anyway
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Generated report */}
      {report && !existingReport && (
        <div className="card">
          <div className="card-hd"><Ic.Report /> {report.reference}</div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', marginBottom: 12 }}>
              Date range: <strong>{startDate}</strong> → <strong>{endDate}</strong> &nbsp;|&nbsp; Destination: <strong>District</strong>
            </div>
            {report.content && (
              <pre style={{
                background: '#f0fdfa', padding: 16, borderRadius: 12,
                fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap',
                maxHeight: 400, overflowY: 'auto', marginBottom: 16,
                border: '1px solid #ccf2ee'
              }}>
                {report.content}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" onClick={download}><Ic.Download /> Download .txt</button>
              {sent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(34,197,94,.1)', border: '1px solid #86efac', borderRadius: 'var(--rl)', color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                  ✓ Report Sent to District
                </div>
              ) : (
                <button className="btn-p" style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
                  onClick={sendToDistrict}>
                  <Ic.Send /> Send to District
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Change Password Modal ────────────────────────────────────
function ChangePasswordModal({ user, addAlert, onClose }) {
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showC, setShowC] = useState(false);
  const [showN, setShowN] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (form.newPw !== form.confirm) { setErr('New passwords do not match.'); return; }
    const pwRes = validatePassword(form.newPw, user?.name, user?.email);
    if (!pwRes.ok) { setErr(pwRes.msg); return; }
    if (form.current === form.newPw) { setErr('New password must differ from current password.'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, current_password: form.current, new_password: form.newPw })
      });
      const d = await r.json();
      if (d.success) { addAlert('Password changed successfully!', 'success'); onClose(); }
      else setErr(d.message || 'Failed to change password.');
    } catch { setErr('Cannot connect to server.'); }
    setLoading(false);
  }

  const EyeBtn = ({ show, toggle }) => (
    <button type="button" onClick={toggle} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4d7c77', display: 'flex', padding: 3 }}>
      {show
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  );

  const fields = [
    { key: 'current', label: 'Current Password', show: showC, toggle: () => setShowC(s => !s) },
    { key: 'newPw',   label: 'New Password',     show: showN, toggle: () => setShowN(s => !s) },
    { key: 'confirm', label: 'Confirm New Password', show: showCf, toggle: () => setShowCf(s => !s) },
  ];

  return (
    <div className="m-overlay">
      <div className="m-box m-animate" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Change Password</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Update your account password</div>
          </div>
          <button onClick={onClose} className="modal-close"><Ic.X /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map(({ key, label, show, toggle }) => (
            <div key={key}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="f-inp"
                  style={{ paddingRight: 40 }}
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required
                />
                <EyeBtn show={show} toggle={toggle} />
              </div>
              {key === 'newPw' && form.newPw && (() => {
                const r = validatePassword(form.newPw, user?.name, user?.email);
                return r.ok
                  ? <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Strong password</div>
                  : <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{r.msg}</div>;
              })()}
              {key === 'confirm' && form.confirm && (
                form.newPw !== form.confirm
                  ? <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>Passwords do not match.</div>
                  : <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Passwords match</div>
              )}
            </div>
          ))}
          {err && <div style={{ background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 10, padding: '9px 13px', fontSize: 12, fontWeight: 500 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn-p" type="submit" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <><Ic.Spin /> Saving…</> : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function SectorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState({ entered: 0, verified: 0, pending: 0, approved: 0 });
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`lpes_photo_sector_${user.id}`);
      if (saved) setProfilePhoto(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API}/sector/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) })
      .then(r => r.json()).then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      fetch(`${API}/sector/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) })
        .then(r => r.json()).then(d => { if (d.success) setStats(d.stats); }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (!user) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f0fdfa' }}>
      <div style={{ color: '#0d9488', fontFamily: '"Times New Roman",Times,serif', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}><Ic.Spin /> Loading…</div>
    </div>
  );

  function doLogout() { localStorage.removeItem('lpe_user'); router.push('/'); }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addAlert('Photo must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target.result;
      setProfilePhoto(data);
      localStorage.setItem(`lpes_photo_sector_${user.id}`, data);
      addAlert('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  const initials = user?.name?.split(' ').filter(Boolean).slice(0,2).map(n => n[0]?.toUpperCase()).join('') || 'SO';

  const TITLES = {
    dashboard: 'My Dashboard', input: 'Input Land Data', verify: 'Verify Land Info',
    mutations: 'Mutations', records: 'Recorded Deeds', reports: 'Reports', pricechek: 'Price Check',
  };

  function renderContent() {
    switch (active) {
      case 'dashboard': return <ViewDashboard setActive={setActive} stats={stats} />;
      case 'input': return <ViewInput user={user} addAlert={addAlert} />;
      case 'verify': return <ViewVerify user={user} addAlert={addAlert} />;
      case 'mutations': return <ViewMutations addAlert={addAlert} />;
      case 'records': return <ViewRecords addAlert={addAlert} />;
      case 'reports': return <ViewReports user={user} addAlert={addAlert} />;
      case 'pricechek': return <ViewPriceCheck addAlert={addAlert} />;
      default: return <ViewDashboard setActive={setActive} stats={stats} />;
    }
  }

  return (
    <>
      <Head>
        <title>{TITLES[active] || 'Dashboard'} — Sector · LPES</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>

      <ToastContainer alerts={alerts} removeAlert={removeAlert} />
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      {showChangePw && <ChangePasswordModal user={user} addAlert={addAlert} onClose={() => setShowChangePw(false)} />}

      {logoutConfirm && (
        <div className="m-overlay" onClick={() => setLogoutConfirm(false)}>
          <div className="m-box m-animate" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center', padding: '32px 28px', position: 'relative' }}>
            <button onClick={() => setLogoutConfirm(false)} className="x-close-btn" style={{ position: 'absolute', top: 16, right: 16 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </div>
            <div style={{ fontFamily: '"Times New Roman",Times,serif', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sign Out?</div>
            <div style={{ fontSize: 13, color: '#4d7c77', marginBottom: 24 }}>You will be redirected to the home page.</div>
            <button onClick={doLogout} className="logout-btn" style={{ width: '100%', padding: '12px 24px', borderRadius: 12, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', fontWeight: 700, fontSize: 14 }}>Yes, Sign Out</button>
          </div>
        </div>
      )}

      <style>{`
        :root{--teal:#0d9488;--teal-d:#0f766e;--teal-l:#f0fdfa;--cyan:#0891b2;--dark:#0c1a19;--g200:#ccf2ee;--g300:#99e6de;--g600:#4d7c77;--sh-sm:0 1px 3px rgba(13,148,136,.12);--sh-md:0 4px 12px rgba(13,148,136,.16);--sh-xl:0 20px 50px rgba(13,148,136,.24);--r:12px;--rl:16px;--rxl:22px;--sb-w:260px;--nav:#0f172a;}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:"Times New Roman",Times,serif;background:#f0fdfa;color:#0c1a19}
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}} @keyframes mIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}} @keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .shell{display:flex;flex-direction:column;height:100vh;overflow:hidden} .shell-body{display:flex;flex:1;overflow:hidden;min-height:0}
        .topbar{height:60px;background:var(--nav);display:flex;align-items:center;flex-shrink:0;z-index:200;border-bottom:1px solid rgba(255,255,255,.07);padding:0;}
        .topbar-brand{width:var(--sb-w);flex-shrink:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;background:#00102a;border-bottom:3px solid white;border-radius:0 0 10px 10px;}
        .topbar-brand-acronym{font-size:20px;font-weight:800;color:#60a5fa;font-family:"Times New Roman",Times,serif;letter-spacing:5px;font-style:italic;line-height:1.2;text-align:center;}
        .topbar-brand-tagline{font-size:9px;color:rgba(255,255,255,.6);font-family:"Times New Roman",Times,serif;margin-top:4px;text-align:center;letter-spacing:.1px;font-style:italic;}
        .topbar-expand-wrap{padding:0;flex-shrink:0;height:100%;} .topbar-expand-btn{display:flex;align-items:center;justify-content:center;height:100%;width:80px;background:white;border:none;border-right:1px solid #e5e7eb;color:#374151;cursor:pointer;transition:background .15s;border-radius:0;padding-top:6px;} .topbar-expand-btn:hover{background:#f3f4f6}
        .topbar-title{flex:1;font-size:14px;color:rgba(255,255,255,.65);font-family:"Times New Roman",Times,serif;font-style:italic;padding:0 16px;}
        .topbar-user-wrap{position:relative;padding:0 16px;flex-shrink:0;} .topbar-user {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 6px;
        background: white;
        border: 1px solid #d1d5db;
        cursor: pointer;
        user-select: none;
        transition: background .18s;
        color: #1f2937;
        } 
        .topbar-user:hover{background:#f9fafb}
        .topbar-user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;flex-shrink:0;}
        .topbar-user-name {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
        font-family: "Times New Roman", Times, serif;
        }
        .topbar-sep{color:#9ca3af;font-size:13px;margin:0 2px} 
        .topbar-role {
        color: #6b7280;
        font-size: 11px;
        font-family: "Times New Roman", Times, serif;
        }
        .topbar-chev{color:#6b7280;display:flex;align-items:center;margin-left:4px}
        .user-dropdown{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);width:240px;background:white;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.18);border:1px solid var(--g200);overflow:hidden;z-index:500;}
        .ud-header{padding:12px 16px 10px;border-bottom:1px solid var(--g200);text-align:center;}
        .ud-avatar-wrap{position:relative;width:52px;height:52px;margin:0 auto 7px;cursor:pointer;}
        .ud-avatar-wrap:hover .ud-cam-overlay{opacity:1;}
        .ud-avatar-img{width:52px;height:52px;border-radius:50%;object-fit:cover;border:2.5px solid #0d9488;display:block;}
        .ud-avatar-init{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;}
        .ud-cam-overlay{position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.45);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;opacity:0;transition:opacity .2s;pointer-events:none;}
        .ud-cam-overlay span{font-size:8px;color:white;font-weight:700;letter-spacing:.3px;}
        .ud-badge{width:18px;height:18px;border-radius:50%;background:#0d9488;border:2px solid white;display:flex;align-items:center;justify-content:center;position:absolute;bottom:0px;right:0px;}
        .ud-name{font-weight:800;font-size:13px;color:#0c1a19;font-family:"Times New Roman",Times,serif;}
        .ud-role{font-size:10px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;}
        .ud-email{font-size:11px;color:#4d7c77;margin-top:4px;}
        .ud-hint{font-size:9px;color:#9ca3af;margin-top:5px;font-style:italic;}
        .ud-signout{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 16px;background:none;border:none;border-top:1px solid var(--g200);cursor:pointer;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;color:#ef4444;transition:background .15s;}
        .ud-signout:hover{background:#fee2e2;}
        .sidebar{width:var(--sb-w);background:var(--nav);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.24s cubic-bezier(0.4,0,0.2,1);border-right:1px solid rgba(255,255,255,.06);overflow:hidden;white-space:nowrap;}
        .sidebar-open{width:var(--sb-w);} .sidebar-closed{width:0;}
        .sb-nav{flex:1;padding:14px 10px;overflow-y:auto;overflow-x:hidden} .sb-section{font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;padding:0 8px 10px;letter-spacing:.6px;white-space:nowrap}
        .sb-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:10px;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:13px;font-weight:500;cursor:pointer;margin-bottom:3px;font-family:"Times New Roman",Times,serif;text-align:left;transition:all .18s;white-space:nowrap}
        .sb-item:hover{background:rgba(255,255,255,.06);color:white} .sb-item.active{background:rgba(13,148,136,.2);color:#0d9488}
        .sb-icon{display:flex;align-items:center;flex-shrink:0} .sb-label{flex:1} .sb-pip{width:5px;height:5px;border-radius:50%;background:#0d9488;flex-shrink:0}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden} .content{flex:1;overflow-y:auto;padding:24px;padding-bottom:40px;} .content::-webkit-scrollbar{width:5px} .content::-webkit-scrollbar-thumb{background:#0d9488;border-radius:3px}
        .view{display:flex;flex-direction:column;gap:18px;max-width:1100px;margin:0 auto;width:100%;padding-bottom:20px;}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .stat-card{background:white;border:1px solid var(--g200);border-top:3px solid var(--c);border-radius:var(--rxl);padding:18px;box-shadow:var(--sh-sm)} .stat-value{font-size:30px;font-weight:800;color:#0c1a19} .stat-label{font-size:13px;font-weight:600;margin-top:4px} .stat-sub{font-size:11px;color:#4d7c77;margin-top:2px}
        .stat-card.clickable:hover{transform:translateY(-2px);box-shadow:var(--sh-md);border-color:var(--teal);cursor:pointer}
        .section-label{font-size:11px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .qa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .qa-card{background:white;border:1.5px solid var(--g200);border-radius:var(--rxl);padding:18px;cursor:pointer;text-align:left;transition:all .2s;font-family:"Times New Roman",Times,serif} .qa-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-md)}
        .qa-dot{width:10px;height:10px;border-radius:50%;margin-bottom:8px} .qa-label{font-size:14px;font-weight:700} .qa-desc{font-size:12px;color:#4d7c77;margin-top:4px}
        .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:visible;animation:fadeUp .4s ease}
        .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:14px 20px;font-family:"Times New Roman",Times,serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:var(--rxl) var(--rxl) 0 0}
        .data-table{width:100%;border-collapse:collapse} .data-table th{text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#4d7c77;background:#f9fefd;border-bottom:1px solid #ccf2ee;white-space:nowrap} .data-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0fdfa;vertical-align:middle} .data-table tr:last-child td{border-bottom:none} .data-table tbody tr:hover{background:#f9fefd}
        .btn-p{display:flex;align-items:center;gap:7px;padding:10px 18px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap} .btn-p:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--sh-md)} .btn-p:disabled{opacity:.7;cursor:not-allowed}
        .btn-ghost{background:#f9fefd;border:1.5px solid var(--g200);padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;color:#4d7c77;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:7px} .btn-ghost:hover{border-color:var(--teal);color:var(--teal)}
        .btn-pred{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;font-size:15px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#7c3aed,#0d9488);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .3s} .btn-pred:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.3)} .btn-pred:disabled{opacity:.7;cursor:not-allowed}
        .s-row{display:flex;gap:10px;padding:16px 20px 8px}
        .s-inp{flex:1;padding:12px 16px;font-size:14px;font-family:"Times New Roman",Times,serif;border:1.5px solid var(--g200);border-radius:var(--rl);outline:none;transition:all .22s;background:white} .s-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-group{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
        .form-label{font-size:10px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .f-inp{padding:11px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%} .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white}
        .empty-state{padding:32px;text-align:center;color:#4d7c77;font-size:14px}
        .loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#4d7c77}
        .m-overlay{position:fixed;inset:0;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
        .m-box{background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);width:100%;max-width:420px;position:relative} .m-animate{animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both}
        .modal-close{background:#f9fefd;border:1px solid var(--g200);border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#4d7c77;transition:color .15s,background .15s,border-color .15s}
        .modal-close:hover{background:rgba(239,68,68,.08);color:#ef4444;border-color:#fca5a5}
        .x-close-btn{background:none;border:none;cursor:pointer;color:#6b7280;display:flex;align-items:center;padding:6px;border-radius:6px;transition:color .15s,background .15s}
        .x-close-btn:hover{color:#ef4444;background:rgba(239,68,68,.1)}.tbl-btn{display:inline-flex;align-items:center;padding:4px 10px;border-radius:8px;border:none;cursor:pointer;font-size:11px;font-weight:700;font-family:"Times New Roman",Times,serif;transition:all .15s;}.tbl-btn:hover{opacity:.8;transform:translateY(-1px)}
        .logout-btn{transition:background .2s,transform .15s} .logout-btn:hover{background:#dc2626 !important;transform:translateY(-1px)}
        .m-box > div:last-child::-webkit-scrollbar{display:none}
        @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}.qa-grid{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div className="topbar-brand"><div className="topbar-brand-acronym">L P E S</div><div className="topbar-brand-tagline">Land Price Estimation System</div></div>
          <div className="topbar-expand-wrap"><button className="topbar-expand-btn" onClick={() => setSidebarOpen(o => !o)}><Ic.Menu /></button></div>
          <div className="topbar-title">A Machine Learning-Based Framework for Land Price Estimation</div>
          <div className="topbar-user-wrap" ref={userMenuRef} style={{ paddingRight: 16, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="topbar-user" onClick={() => setUserMenuOpen(o => !o)}>
            <div className="topbar-user-avatar">
              {profilePhoto
                ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
              <span className="topbar-user-name">{user?.name}</span>
              <span className="topbar-role">Sector: {user?.sector_name || 'Not Assigned'}</span>
            </div>
            <span className="topbar-chev"><Ic.ChevDown /></span>
          </div>
          {userMenuOpen && (
            <div className="user-dropdown">
              <div className="ud-header">
                <div className="ud-avatar-wrap" onClick={() => photoInputRef.current?.click()} title="Click to change profile photo">
                  {profilePhoto
                    ? <img src={profilePhoto} alt="avatar" className="ud-avatar-img" />
                    : <div className="ud-avatar-init">{initials}</div>}
                  <div className="ud-cam-overlay">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span>Change</span>
                  </div>
                  <div className="ud-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                </div>
                <div className="ud-name">{user?.name}</div>
                <div className="ud-role">Sector Officer</div>
                {user?.email && <div className="ud-email">{user.email}</div>}
                <div className="ud-hint">Click photo to update</div>
              </div>
      
              <button
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'none', border: 'none', borderTop: '1px solid var(--g200)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Times New Roman",Times,serif', color: '#0d9488', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0fdfa'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                onClick={() => { setUserMenuOpen(false); setShowChangePw(true); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Change Password
              </button>

              <button className="ud-signout" onClick={() => { setUserMenuOpen(false); setLogoutConfirm(true); }}>
                <Ic.Logout /> Sign Out
              </button>
            </div>
          )}
        </div>
        </div>
        <div className="shell-body">
          <Sidebar active={active} sidebarOpen={sidebarOpen} setActive={setActive} />
          <div className="main"><div className="content">{renderContent()}</div></div>
        </div>
      </div>
    </>
  );
}