// ============================================================
// NOTARY DASHBOARD — pages/dashboard/notary.js
// Handles both Private Notary and Sector Notary
// notary_type is set at LOGIN and stored in localStorage
// Private notary → label "Private Notary", reports go to admin
// Sector notary  → label "Sector Notary",  reports go to district
// ============================================================
import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

const API = 'https://land-price-api-35fr.onrender.com';

function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem('lpe_user');
    if (!s) { router.replace('/'); return; }
    let u;
    try { u = JSON.parse(s); } catch { router.replace('/'); return; }
    if (u.role !== 'notary') {
      const map = {
        system_admin: '/dashboard/admin',
        district_land_officer: '/dashboard/district',
        sector_land_officer: '/dashboard/sector',
        buyer_seller: '/dashboard/buyer',
      };
      router.replace(map[u.role] || '/');
      return;
    }
    // notary_type is already in localStorage from login response
    // Only call /auth/me if notary_type is missing (older session)
    if (u.notary_type) {
      setUser(u);
    } else {
      fetch(`${API}/auth/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id }),
      })
        .then(r => r.json())
        .then(d => {
          const notary_type = d.success ? (d.user.notary_type || 'sector') : 'sector';
          const updated = { ...u, notary_type, phone: d.success ? d.user.phone : u.phone };
          // Persist updated notary_type to localStorage so this only runs once
          localStorage.setItem('lpe_user', JSON.stringify(updated));
          setUser(updated);
        })
        .catch(() => setUser({ ...u, notary_type: 'sector' }));
    }
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
const fmtDateTime = s => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const calcTax = p => p > 5_000_000 ? (p - 5_000_000) * 0.025 : 0;

// ── SVG Icons ──────────────────────────────────────────────
const Ic = {
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  Shield: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  Report: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  Logout: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  X: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  Spin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  Download: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  User: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  ChevDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  Calendar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Upload: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  Stamp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5s-5-2.24-5-5a5 5 0 0 1 5-5z" /><path d="M20 22H4v-2a8 8 0 0 1 16 0v2z" /></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Menu: () => (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor" />
      <rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor" />
    </svg>
  ),
  Records: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'requests', label: 'Notary Requests', icon: 'Bell' },
  { id: 'records', label: 'Recorded Deeds', icon: 'Records' },
  { id: 'pricechek', label: 'Price Check', icon: 'Search' },
  { id: 'reports', label: 'Reports', icon: 'Report' },
];

// ── Toast ──────────────────────────────────────────────────
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

// ── Sidebar ────────────────────────────────────────────────
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

// ── Dashboard ──────────────────────────────────────────────
function ViewDashboard({ setActive, stats, user }) {
  const isPrivate = user?.notary_type === 'private';
  return (
    <div className="view">
      <div className="stats-grid">
        {[
          { label: 'Pending Requests', value: stats.pending || 0, color: '#f59e0b', sub: 'awaiting action', clickable: true, target: 'requests' },
          { label: 'Appointments Set', value: stats.appointment_set || 0, color: '#0891b2', sub: 'scheduled', clickable: true, target: 'requests' },
          { label: 'Stamped & Signed', value: stats.stamped || 0, color: '#7c3aed', sub: 'completed', clickable: true, target: 'requests' },
          { label: 'Sent to ' + (isPrivate ? 'Admin' : 'District'), value: stats.sent || 0, color: '#22c55e', sub: 'forwarded', clickable: true, target: 'requests', filterValue: isPrivate ? 'sent_to_admin' : 'sent_to_district' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.clickable ? 'clickable' : ''}`} style={{ '--c': s.color, cursor: s.clickable ? 'pointer' : 'default' }} onClick={() => {
            if (s.clickable) {
              // Store filter in session storage for specific cards
              if (s.label === 'Appointments Set') {
                sessionStorage.setItem('notary_stat_filter', 'appointment_set');
              } else if (s.label === 'Stamped & Signed') {
                sessionStorage.setItem('notary_stat_filter', 'stamped');
              } else if (s.label.startsWith('Sent to')) {
                // Set appropriate filter based on notary type
                sessionStorage.setItem('notary_stat_filter', s.filterValue);
              }
              setActive(s.target);
            }
          }}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="section-label">QUICK ACTIONS</div>
      <div className="qa-grid">
        {[
          { label: 'Notary Requests', desc: 'Review, set appointments, stamp & send', id: 'requests', color: '#0d9488' },
          { label: 'Recorded Deeds', desc: 'All completed land transfers', id: 'records', color: '#22c55e' },
          { label: 'Reports', desc: `Generate & send to ${isPrivate ? 'Admin' : 'District'}`, id: 'reports', color: '#7c3aed' },
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

// ── Upload Field Helper ────────────────────────────────────
function UploadField({ label, fieldKey, uploads, setUploads, required = false }) {
  const inputRef = useRef(null);
  const file = uploads[fieldKey];
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && ' *'}</label>
      <div
        className="upload-zone"
        onClick={() => inputRef.current?.click()}
        style={{ borderColor: file ? '#0d9488' : undefined, background: file ? 'rgba(13,148,136,.04)' : undefined }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0d9488' }}>{file.name}</span>
            <button onClick={e => { e.stopPropagation(); setUploads(p => ({ ...p, [fieldKey]: null })); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 4 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4d7c77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <div style={{ fontSize: 13, color: '#4d7c77', fontWeight: 600 }}>Click to upload</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>PDF, JPG, PNG — max 5 MB</div>
            </>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) setUploads(p => ({ ...p, [fieldKey]: e.target.files[0] })); }} />
    </div>
  );
}

// ── Notary Requests ────────────────────────────────────────
function ViewRequests({ user, addAlert }) {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('pending');

  // Handle URL parameter for filtering and session storage for stat card clicks
  useEffect(() => {
    // Check for URL parameter first
    if (router.query.filter) {
      setFilter(router.query.filter);
      // Clear the URL parameter after using it
      router.replace('/dashboard/notary', undefined, { shallow: true });
    } else {
      // Check session storage for stat card clicks
      const statFilter = sessionStorage.getItem('notary_stat_filter');
      if (statFilter) {
        setFilter(statFilter);
        sessionStorage.removeItem('notary_stat_filter');
      }
    }
  }, [router.query.filter]);
  const [apptModal, setApptModal] = useState(null);
  const [stampModal, setStampModal] = useState(null);
  const [sendModal, setSendModal] = useState(null);
  const [formData, setFormData] = useState(null);
  const [uploads, setUploads] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadedRequests, setUploadedRequests] = useState({});
  const [notarizedDocs, setNotarizedDocs] = useState({});
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const isPrivate = user?.notary_type === 'private';

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/notary-requests/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notary_id: user?.id }),
      });
      const d = await r.json();
      if (d.success) setRequests(d.requests || []);
    } catch { if (!silent) addAlert('Cannot load requests', 'error'); }
    if (!silent) setLoading(false);
  }

  async function loadForm(formId) {
    if (!formId) return;
    try {
      const r = await fetch(`${API}/sale-form/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: formId }),
      });
      const d = await r.json();
      if (d.success) setFormData(d.form);
    } catch { }
  }

  async function loadDocuments(requestId) {
    setDocsLoading(true);
    setDocsData(null);
    try {
      const r = await fetch(`${API}/notary-request/documents/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      const d = await r.json();
      if (d.success) setDocsData(d);
      else addAlert(d.message || 'Failed to load documents', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setDocsLoading(false);
  }

  async function verifyDocument(docId, requestId) {
    try {
      const r = await fetch(`${API}/notary-request/documents/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: docId, request_id: requestId, verified: true }),
      });
      const d = await r.json();
      if (d.success) {
        addAlert('Document verified successfully!', 'success');
        loadDocuments(requestId);
        load(true);
      } else addAlert(d.message || 'Verification failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  async function verifyAllDocuments(requestId) {
    try {
      const r = await fetch(`${API}/notary-request/documents/verify-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, verified: true }),
      });
      const d = await r.json();
      if (d.success) {
        addAlert('All documents verified successfully!', 'success');
        loadDocuments(requestId);
        load(true);
      } else addAlert(d.message || 'Verification failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => { if (user?.id) load(true); }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  async function setAppointment(req) {
    if (!apptModal?.date) { addAlert('Please select a date', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/notary-request/set-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: req.id,
          agreement_id: req.agreement_id,
          appointment_date: apptModal.date,
          appointment_time: apptModal.time,
          location: apptModal.location,
        }),
      });
      const d = await r.json();
      if (d.success) {
        addAlert('Appointment set! Buyer and seller will be notified.', 'success');
        setApptModal(null);
        load();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setSaving(false);
  }

  async function uploadDocuments(req) {
    const files = Object.entries(uploads).filter(([, v]) => v);
    if (!uploads.signed_agreement) { addAlert('Notarized Document is required before uploading.', 'error'); return; }
    if (files.length === 0) { addAlert('Please select at least one file', 'error'); return; }
    setSaving(true);
    try {
      for (const [key, file] of files) {
        const fd = new FormData();
        fd.append('request_id', req.id);
        fd.append('agreement_id', req.agreement_id);
        fd.append('doc_type', key);
        fd.append(key, file);
        await fetch(`${API}/notary-documents/upload`, { method: 'POST', body: fd });
      }
      addAlert(`${files.length} document(s) uploaded successfully.`, 'success');
      setNotarizedDocs(prev => ({ ...prev, [req.id]: uploads.signed_agreement }));
      setUploads({});
      setUploadedRequests(prev => ({ ...prev, [req.id]: true }));
    } catch { addAlert('Upload failed', 'error'); }
    setSaving(false);
  }

  async function stampAndSign(req) {
    if (!stampModal?.cert_number) { addAlert('Certificate number is required', 'error'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('request_id', req.id);
      fd.append('agreement_id', req.agreement_id);
      fd.append('cert_number', stampModal.cert_number);
      fd.append('signed_date', stampModal.signed_date || new Date().toISOString().split('T')[0]);
      if (stampModal.stamped_doc) fd.append('stamped_doc', stampModal.stamped_doc);

      const r = await fetch(`${API}/notary-request/stamp`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) {
        addAlert('Documents stamped and signed!', 'success');
        setStampModal(null);
        load();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setSaving(false);
  }

  async function sendToAuthority(req) {
    setSaving(true);
    try {
      const r = await fetch(`${API}/notary-request/send-to-district`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: req.id,
          agreement_id: req.agreement_id,
          notary_id: user?.id,
          upi: req.upi,
          notes: sendModal?.notes || '',
        }),
      });
      const d = await r.json();
      if (d.success) {
        const dest = isPrivate ? 'Admin' : 'District';
        addAlert(`Documents sent to ${dest}! Ref: ${d.district_ref}`, 'success');
        setSendModal(null);
        load();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setSaving(false);
  }

  const statusColor = s => ({
    pending: '#f59e0b',
    appointment_set: '#0891b2',
    stamped: '#7c3aed',
    sent_to_district: '#22c55e',
    sent_to_admin: '#22c55e',   // ← add this
  }[s] || '#94a3b8');

  const statusLabel = s => ({
    pending: 'Pending',
    appointment_set: 'Appointment Set',
    stamped: 'Stamped & Signed',
    sent_to_district: 'Sent to District',
    sent_to_admin: 'Sent to Admin',      // ← add this
  }[s] || s);

  const filtered = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'sent_to_admin') return r.status === 'sent_to_admin';
    if (filter === 'sent_to_district') return r.status === 'sent_to_district';
    return r.status === filter;
  });

  // Helper to get readable document label
  const getDocLabel = (docType) => {
    const labels = {
      'signed_agreement': 'Notarized Document',
      'official_form': 'Official Form',
      'support_doc_1': 'Supporting Document 1',
      'support_doc_2': 'Supporting Document 2',
      'stamped_agreement': 'Stamped Agreement',
      'seller_id': 'Seller National ID',
      'spouse_id': 'Spouse National ID',
      'buyer_id': 'Buyer National ID',
      'land_title': 'Land Title Document',
      'civil_cert_seller': 'Civil Status Certificate - Seller',
      'civil_cert_buyer': 'Civil Status Certificate - Buyer',
    };
    return labels[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="view">
      {/* Documents Modal */}
      {docsModal && (
        <div className="m-overlay" onClick={() => { setDocsModal(null); setDocsData(null); }}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0, padding: '20px 24px 0', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Review Documents</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>UPI: {docsModal.upi}</div>
              </div>
              <button className="x-close-btn" onClick={() => { setDocsModal(null); setDocsData(null); }}>✕</button>
            </div>
            <div style={{ overflowY: 'scroll', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 24px 16px' }}>
              {docsLoading && <div style={{ padding: 30, textAlign: 'center', color: '#4d7c77' }}>Loading documents...</div>}
              {!docsLoading && docsData && (
                <>
                  {/* Document count and verify all button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'sticky', top: 0, background: 'white', zIndex: 9, paddingTop: 4, paddingBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase' }}>
                      Documents ({docsData.total || 0})
                    </div>
                    <button 
                      className="btn-p" 
                      style={{ padding: '6px 12px', fontSize: 11, background: 'linear-gradient(135deg,#10b981,#059669)' }}
                      onClick={() => verifyAllDocuments(docsModal.id)}
                    >
                      ✓ Verify All Documents
                    </button>
                  </div>
                  
                  {/* Documents list */}
                  {(!docsData.documents || docsData.documents.length === 0) && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: 13 }}>No documents found for this request.</div>
                  )}
                  
                  {docsData.documents && docsData.documents.map((doc, i) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      padding: '10px 14px', 
                      background: doc.verified ? 'rgba(13,148,136,.05)' : doc.source === 'notary' ? '#f0fdfa' : '#eff6ff', 
                      border: `1px solid ${doc.verified ? '#86efac' : (doc.source === 'notary' ? '#ccf2ee' : '#bfdbfe')}`,
                      borderRadius: 10, 
                      marginBottom: 8 
                    }}>
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 8, 
                        background: doc.source === 'notary' ? '#0d9488' : '#0891b2', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0, 
                        color: 'white', 
                        fontSize: 12 
                      }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{getDocLabel(doc.doc_type)}</div>
                        <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.original_name || doc.file_path || '—'}
                        </div>
                        <div style={{ fontSize: 10, color: doc.source === 'notary' ? '#0d9488' : '#0891b2', marginTop: 1 }}>
                          Source: {doc.source === 'notary' ? 'Notary Uploaded' : 'Buyer/Seller Uploaded'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {doc.verified ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(22,163,74,.1)', color: '#16a34a' }}>✓ Verified</span>
                        ) : (
                          <button 
                            className="tbl-btn" 
                            style={{ background: 'rgba(13,148,136,.1)', color: '#0d9488' }}
                            onClick={() => verifyDocument(doc.id, docsModal.id)}
                          >
                            Mark Verified
                          </button>
                        )}
                        {doc.file_path && (
                          <a 
                            href={`${API}/uploads/${doc.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tbl-btn"
                            style={{ background: 'rgba(8,145,178,.1)', color: '#0891b2', textDecoration: 'none' }}
                          >
                            View
                          </a>
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

            {/* Appointment Modal */}
      {apptModal && (
        <div className="m-overlay" onClick={() => setApptModal(null)}>
          <div className="m-box m-animate" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-hd" style={{ borderRadius: '22px 22px 0 0', marginBottom: 20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Calendar /> Set Appointment Date</span>
              <button onClick={() => setApptModal(null)} className="x-close-btn" style={{ color:'rgba(255,255,255,.7)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Appointment Date *</label>
                  <input 
                    className="f-inp" 
                    type="date" 
                    min={new Date().toISOString().split('T')[0]}
                    value={apptModal.date || ''} 
                    onChange={e => setApptModal(p => ({ ...p, date: e.target.value, timeError: '' }))} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input 
                    className="f-inp" 
                    type="time" 
                    value={apptModal.time || ''} 
                    onChange={e => {
                      const selectedTime = e.target.value;
                      const selectedDate = apptModal.date;
                      let timeError = '';
                      
                      if (selectedDate && selectedTime) {
                        const selectedDateTime = new Date(`${selectedDate}T${selectedTime}`);
                        const now = new Date();
                        if (selectedDateTime < now) {
                          timeError = 'Cannot select past time. Please choose a future time.';
                        }
                      }
                      setApptModal(p => ({ ...p, time: selectedTime, timeError }));
                    }} 
                  />
                  {apptModal.timeError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{apptModal.timeError}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Location / Office Address</label>
                <input className="f-inp" value={apptModal.location || ''} onChange={e => setApptModal(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Sector Office Location" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  className="btn-pred" 
                  style={{ flex: 1, margin: 0, padding: '11px' }} 
                  onClick={() => {
                    if (!apptModal.date) {
                      addAlert('Please select a date', 'error');
                      return;
                    }
                    if (apptModal.timeError) {
                      addAlert(apptModal.timeError, 'error');
                      return;
                    }
                    setAppointment(apptModal.req);
                  }} 
                  disabled={saving || !apptModal.date}
                >
                  {saving ? <><Ic.Spin /> Setting…</> : <><Ic.Calendar /> Confirm Appointment</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stamp Modal */}
      {stampModal && (
        <div className="m-overlay" onClick={() => setStampModal(null)}>
          <div className="m-box m-animate" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="card-hd" style={{ borderRadius: '22px 22px 0 0', marginBottom: 20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Stamp /> Stamp &amp; Sign Documents</span>
              <button onClick={() => setStampModal(null)} className="x-close-btn" style={{ color:'rgba(255,255,255,.7)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Certificate / Ref Number *</label>
                  <input className="f-inp" value={stampModal.cert_number || ''} onChange={e => setStampModal(p => ({ ...p, cert_number: e.target.value }))} placeholder="e.g. CERT-2026-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Signing Date</label>
                  <input 
                    className="f-inp" 
                    type="date" 
                    max={new Date().toISOString().split('T')[0]}
                    value={stampModal.signed_date || ''} 
                    onChange={e => setStampModal(p => ({ ...p, signed_date: e.target.value }))} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notarized Document to Stamp</label>
                  <div className="upload-zone"
                  onClick={() => !stampModal.stamped_doc && document.getElementById('stamp-file-input')?.click()}
                  style={{ cursor: stampModal.stamped_doc ? 'default' : 'pointer' }}>
                  {stampModal.stamped_doc ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✓</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0d9488' }}>{stampModal.stamped_doc.name}</span>
                      <span style={{ fontSize: 10, color: '#4d7c77', marginLeft: 4 }}>(from Step 2)</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom: 4 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4d7c77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      </div>
                      <div style={{ fontSize: 13, color: '#4d7c77', fontWeight: 600 }}>Upload stamped agreement</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>PDF, JPG, PNG</div>
                    </>
                  )}
                </div>
                <input id="stamp-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) setStampModal(p => ({ ...p, stamped_doc: e.target.files[0] })); }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  className="btn-pred" 
                  style={{ flex: 1, margin: 0, padding: '11px', background: 'linear-gradient(135deg,#7c3aed,#0d9488)' }} 
                  onClick={() => {
                    if (!stampModal.cert_number) {
                      addAlert('Certificate number is required', 'error');
                      return;
                    }
                    stampAndSign(stampModal.req);
                  }} 
                  disabled={saving}
                >
                  {saving ? <><Ic.Spin /> Stamping…</> : <><Ic.Stamp /> Confirm Stamp &amp; Sign</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send to District/Admin Modal */}
      {sendModal && (
        <div className="m-overlay" onClick={() => setSendModal(null)}>
          <div className="m-box m-animate" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="card-hd" style={{ borderRadius: '22px 22px 0 0', marginBottom: 20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Send /> Send to {isPrivate ? 'Admin' : 'District'}</span>
              <button onClick={() => setSendModal(null)} className="x-close-btn" style={{ color:'rgba(255,255,255,.7)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="info-banner" style={{ marginBottom: 16 }}>
                <Ic.Info />
                <span>All uploaded documents will be forwarded digitally. This action will finalize the land transfer process.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <textarea className="f-inp" rows={3} value={sendModal.notes || ''} onChange={e => setSendModal(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes for the receiving officer…" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  className="btn-pred" 
                  style={{ flex: 1, margin: 0, padding: '11px', background: 'linear-gradient(135deg,#22c55e,#0d9488)' }} 
                  onClick={() => sendToAuthority(sendModal.req)} 
                  disabled={saving}
                >
                  {saving ? <><Ic.Spin /> Sending…</> : <><Ic.Send /> Confirm Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Bell /> Notary Requests</span>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.15)', borderRadius: 40, padding: 3 }}>
            {[['pending', 'Pending'], ['appointment_set', 'Appointed'], ['stamped', 'Stamped'], [isPrivate ? 'sent_to_admin' : 'sent_to_district', 'Sent'], ['all', 'All']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                style={{ padding: '5px 12px', borderRadius: 40, border: 'none', background: filter === v ? 'white' : 'transparent', color: filter === v ? '#0d9488' : 'rgba(255,255,255,.8)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
        </div>

        {loading && <div className="loading-state"><Ic.Spin /> Loading requests…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No {filter === 'all' ? '' : filter.replace('_', ' ')} requests.</div>}

        {!loading && filtered.map(req => (
          <div key={req.id} style={{ borderTop: '1px solid var(--g200)', padding: '16px 20px', borderLeft: req.status === 'pending' ? '3px solid #f59e0b' : '3px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 13 }}>{req.request_ref}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(req.status) }}>● {statusLabel(req.status)}</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#4d7c77' }}>{req.upi}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <strong>{req.seller_name}</strong> → <strong>{req.buyer_name}</strong>
                  {req.agreed_price && <> &nbsp;|&nbsp; {fmt(req.agreed_price)}</>}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtDateTime(req.created_at)}</div>
                {req.appointment_date && (
                  <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 600, marginTop: 4, display:'flex', alignItems:'center', gap:5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Appointment: {fmtDate(req.appointment_date)} {req.appointment_time && `at ${req.appointment_time}`}
                    {req.appointment_location && ` — ${req.appointment_location}`}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-p" style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={() => {
                    if (selected?.id === req.id) { setSelected(null); setFormData(null); }
                    else { setSelected(req); loadForm(req.form_id); }
                  }}>
                  {selected?.id === req.id ? 'Close' : 'View'}
                </button>
                <button 
                  className="btn-p" 
                  style={{ padding: '6px 14px', fontSize: 12, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
                  onClick={() => {
                    setDocsModal(req);
                    loadDocuments(req.id);
                  }}
                >
                   Review Docs
                </button>
              </div>
            </div>

            {selected?.id === req.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--g200)' }}>
                {formData && (
                  <div style={{ background: 'var(--teal-l)', border: '1px solid var(--g200)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Form 11.a &amp; 11.b Data</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                      {[
                        ['Seller Name', formData.seller_name],
                        ['Seller National ID', formData.seller_national_id],
                        ['Seller Phone', formData.seller_phone],
                        ['Buyer Name', formData.buyer_name],
                        ['Buyer National ID', formData.buyer_national_id],
                        ['UPI', formData.upi],
                        ['Land Value', formData.land_value ? fmt(formData.land_value) : '—'],
                        ['Development Value', formData.development_value && formData.development_value > 0 ? fmt(formData.development_value) : ''],
                        ['Agreed Price', formData.agreed_price ? fmt(formData.agreed_price) : '—'],
                        ['Married', formData.married === 'yes' ? 'Yes' : 'No'],
                        ['Spouse Name', formData.spouse_name || '—'],
                        ['Form Ref', formData.form_ref],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: 'white', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--g200)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px' }}>{k}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{v || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

  {/* STEP 1 — only when pending */}
  {req.status === 'pending' && (
    <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#92400e' }}>Step 1 — Set Appointment</div>
      <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>Review the form data above, then set an appointment date for the seller and buyer to come in person to sign.</div>
      <button className="btn-p" style={{ padding: '8px 20px', fontSize: 13 }}
        onClick={() => setApptModal({ req, date: '', time: '', location: '', timeError: '' })}>
        Set Appointment Date
      </button>
    </div>
  )}

  {/* STEP 1 done indicator — shown in appointment_set+ */}
  {(req.status === 'appointment_set' || req.status === 'stamped' || (req.status === 'sent_to_district' || req.status === 'sent_to_admin')) && (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
        Step 1 Done — Appointment: {fmtDate(req.appointment_date)} {req.appointment_time && `at ${req.appointment_time}`}
        {req.appointment_location && ` — ${req.appointment_location}`}
      </div>
    </div>
  )}

  {req.status === 'appointment_set' && new Date() < new Date(req.appointment_date) && (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
        Step 2 unlocks on {fmtDate(req.appointment_date)} — the appointment date must be reached before uploading documents.
      </div>
    </div>
  )}

  {/* STEP 2 — only when appointment_set AND not yet uploaded */}
  {req.status === 'appointment_set' && !uploadedRequests[req.id] && new Date() >= new Date(req.appointment_date) && (
    <div style={{ background: 'var(--teal-l)', border: '1px solid var(--g200)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#0d9488' }}>Step 2 — Upload Notary Documents</div>
      <div style={{ fontSize: 12, color: '#4d7c77', marginBottom: 10 }}>
        The <strong>Notarized Document is required</strong> — this is the document you will stamp and sign. Other documents are optional.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <UploadField label="Notarized Document *" fieldKey="signed_agreement" uploads={uploads} setUploads={setUploads} required />
        <UploadField label="Official Form (optional)" fieldKey="official_form" uploads={uploads} setUploads={setUploads} />
        <UploadField label="Supporting Document 1 (optional)" fieldKey="support_doc_1" uploads={uploads} setUploads={setUploads} />
        <UploadField label="Supporting Document 2 (optional)" fieldKey="support_doc_2" uploads={uploads} setUploads={setUploads} />
      </div>
      {!uploads.signed_agreement && (
        <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Notarized Document must be uploaded to continue.
        </div>
      )}
      <button
        className="btn-p"
        style={{ padding: '8px 20px', fontSize: 13, opacity: uploads.signed_agreement ? 1 : 0.5 }}
        onClick={() => uploadDocuments(req)}
        disabled={saving || !uploads.signed_agreement}
      >
        {saving ? <><Ic.Spin /> Uploading…</> : 'Upload Documents'}
      </button>
      {!uploadedRequests[req.id] && uploads.signed_agreement && (
        <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 8, fontStyle: 'italic' }}>
          ↳ Step 3 (Stamp &amp; Sign) will unlock after uploading.
        </div>
      )}
    </div>
  )}

  {/* STEP 2 done indicator — shown after upload this session OR in stamped+ */}
  {req.status === 'appointment_set' && uploadedRequests[req.id] && (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
        Step 2 Done — Notarized Document uploaded{uploads.signed_agreement?.name ? `: "${uploads.signed_agreement.name}"` : ''}.
      </div>
    </div>
  )}
  {(req.status === 'stamped' || req.status === 'sent_to_district') && (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Step 2 Done — Notary documents uploaded.</div>
    </div>
  )}

  {/* STEP 3 — only when appointment_set AND docs uploaded this session */}
  {req.status === 'appointment_set' && uploadedRequests[req.id] && (
    <div style={{ background: 'rgba(124,58,237,.05)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#7c3aed' }}>Step 3 — Stamp &amp; Sign</div>
      <div style={{ fontSize: 12, color: '#6d28d9', marginBottom: 10 }}>
        Stamp and sign the <strong>Notarized Document</strong> uploaded in Step 2. Enter your certificate number and signing date below.
      </div>
      <button className="btn-p" style={{ padding: '8px 20px', fontSize: 13, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
        onClick={() => setStampModal({ req, cert_number: '', signed_date: new Date().toISOString().split('T')[0], stamped_doc: notarizedDocs[req.id] || null })}>
        <Ic.Stamp /> Stamp &amp; Sign Notarized Document
      </button>
    </div>
  )}

  {/* STEP 3 done indicator — shown in stamped+ */}
  {(req.status === 'stamped' || req.status === 'sent_to_district') && (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Step 3 Done — Documents stamped &amp; signed.</div>
    </div>
  )}

  {/* STEP 4 — only when stamped */}
  {req.status === 'stamped' && (
    <div style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#15803d' }}>
        Step 4 — Send to {isPrivate ? 'Admin' : 'District'}
      </div>
      <div style={{ fontSize: 12, color: '#166534', marginBottom: 10 }}>
        Send all documents digitally to the {isPrivate ? 'System Admin' : 'District Land Officer'} for final processing.
      </div>
      <button className="btn-p" style={{ padding: '8px 20px', fontSize: 13, background: 'linear-gradient(135deg,#22c55e,#15803d)' }}
        onClick={() => setSendModal({ req, notes: '' })}>
        Send to {isPrivate ? 'Admin' : 'District'}
      </button>
    </div>
  )}

  {/* ALL DONE */}
  {(req.status === 'sent_to_district' || req.status === 'sent_to_admin') && (
    <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
        ✓ Completed — Sent to {isPrivate ? 'Admin' : 'District'}
      </div>
      <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
        This transfer has been fully processed and forwarded for ownership change.
      </div>
    </div>
  )}

</div>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recorded Deeds ─────────────────────────────────────────
function ViewRecords({ user, addAlert }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const isPrivate = user?.notary_type === 'private';

  async function loadRecords(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/notary-requests/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notary_id: user?.id }),
      });
      const d = await r.json();
      if (d.success) setRecords((d.requests || []).filter(r => r.status === 'sent_to_district' || r.status === 'sent_to_admin'));
    } catch { if (!silent) addAlert('Cannot load records', 'error'); }
    if (!silent) setLoading(false);
  }

  useEffect(() => { loadRecords(false); }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => { if (user?.id) loadRecords(true); }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Records /> Recorded Land Transfers ({records.length})</div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && records.length === 0 && <div className="empty-state">No completed transfers yet.</div>}
        {!loading && records.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>UPI</th>
                  <th>Seller</th>
                  <th>Buyer</th>
                  <th>Agreed Price</th>
                  <th>Sent To</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 12 }}>{r.request_ref}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.upi}</td>
                    <td>{r.seller_name}</td>
                    <td>{r.buyer_name}</td>
                    <td style={{ fontWeight: 700 }}>{r.agreed_price ? fmt(r.agreed_price) : '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: isPrivate ? 'rgba(124,58,237,.1)' : 'rgba(13,148,136,.1)', color: isPrivate ? '#7c3aed' : '#0d9488' }}>
                        {isPrivate ? 'Admin' : 'District'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(r.created_at)}</td>
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

      // Price must never be below min — above max is allowed
      const belowMin = agreed < minP;
      const inRange = !belowMin;

      const diff = agreed - avgP;
      const diffPct = ((diff / avgP) * 100).toFixed(1);

      let verdict = '';
      if (belowMin) verdict = `Price is below the minimum allowed value of ${fmt(minP)}.`;

      const tax = agreed > 5_000_000 ? (agreed - 5_000_000) * 0.025 : 0;

      setResult({ minP, avgP, maxP, agreed, inRange, diff, diffPct, verdict, validLow, validHigh, greaterIsUpper, tax, upi: upi.trim(), land: d.land || {} });
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
                    <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: result.tax > 0 ? '#f59e0b' : '#10b981' }}>
                      {result.tax > 0
                        ? `Tax: ${fmt(result.tax)} (2.5% above 5M)`
                        : '✓ No Tax (below 5,000,000 RWF)'}
                    </div>
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
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: result.inRange ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {result.inRange
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                }
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: result.inRange ? '#15803d' : '#dc2626', marginBottom: 4 }}>
                  {result.inRange ? 'Transaction Price Verified' : 'Price Discrepancy Detected'}
                </div>
                <div style={{ fontSize: 13, color: result.inRange ? '#166534' : '#991b1b' }}>
                  {result.inRange
                    ? result.agreed > result.maxP
                      ? `The agreed price of ${fmt(result.agreed)} is above the maximum (${fmt(result.maxP)}) — this is allowed.`
                      : `The agreed price of ${fmt(result.agreed)} is at or above the minimum. This transaction follows system rules.`
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

// ── Reports ────────────────────────────────────────────────
function ViewReports({ user, addAlert }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [existingReport, setExistingReport] = useState(null);
  const [sent, setSent] = useState(false);   // ← add this line
  const isPrivate = user?.notary_type === 'private';
  const dest = isPrivate ? 'Admin' : 'District';
 
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
    try {
      const body = { user_id: user?.id, start_date: startDate, end_date: endDate };
 
      // Check if report already exists for this range
      const checkR = await fetch(`${API}/notary/report/check`, {
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
 
      const r = await fetch(`${API}/notary/report`, {
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
 
  async function sendReport(ref) {
    if (!ref) return;
    try {
      const r = await fetch(`${API}/notary/report/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_ref: ref, user_id: user?.id }),
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Report sent to ${dest}!`, 'success');
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
 
  function download(rep) {
    const blob = new Blob([
      `NOTARY REPORT\n=============\nRef: ${rep.reference}\n` +
      `Notary: ${user?.name}\nType: ${isPrivate ? 'Private Notary' : 'Sector Notary'}\n` +
      `Generated: ${new Date().toLocaleString('en-GB')}\n\n${rep.content || ''}`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rep.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
 
  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Report /> Generate Report</div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{
            background: isPrivate ? 'rgba(124,58,237,.06)' : 'var(--teal-l)',
            border: `1px solid ${isPrivate ? 'rgba(124,58,237,.2)' : 'var(--g200)'}`,
            borderRadius: 12, padding: '10px 14px', fontSize: 13,
            color: isPrivate ? '#7c3aed' : '#0d9488',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Ic.Info />
            {isPrivate
              ? 'As a Private Notary, your reports are sent directly to the System Admin.'
              : 'As a Sector Notary, your reports are sent to the District Land Officer.'}
          </div>
 
          {/* Date range — only input needed */}
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
              The report will include all activities (requests, appointments, stamped deeds, sent transfers) recorded within this date range.
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
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
              A report was already generated for <strong>{startDate}</strong> to <strong>{endDate}</strong>.
            </div>
            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14
            }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                {existingReport.reference}
              </div>
              <div style={{ fontSize: 11, color: '#b45309' }}>
                Generated: {existingReport.generated_at
                  ? new Date(existingReport.generated_at).toLocaleString('en-GB')
                  : '—'}
              </div>
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
          <div className="card-hd"
            style={{ background: isPrivate ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#0d9488,#0891b2)' }}>
            <Ic.Report /> {report.reference}
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#0d9488', marginBottom: 12,
              display: 'flex', gap: 16, flexWrap: 'wrap'
            }}>
              <span>Date range: <strong>{startDate}</strong> → <strong>{endDate}</strong></span>
              <span>Destination: <strong>{dest}</strong></span>
            </div>
            {report.content && (
              <pre style={{
                background: 'var(--teal-l)', padding: 16, borderRadius: 12,
                fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap',
                maxHeight: 400, overflowY: 'auto', marginBottom: 16,
                border: '1px solid var(--g200)'
              }}>
                {report.content}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" onClick={() => download(report)}>
                <Ic.Download /> Download .txt
              </button>
              {sent ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(34,197,94,.1)', border: '1px solid #86efac', borderRadius: 'var(--rl)', color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                  ✓ Report Sent to {dest}
                </div>
              ) : (
                <button className="btn-p"
                  style={{ background: isPrivate ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'linear-gradient(135deg,#0d9488,#0891b2)' }}
                  onClick={() => sendReport(report.reference)}>
                  <Ic.Send /> Send to {dest}
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

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════
export default function NotaryDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState({ pending: 0, appointment_set: 0, stamped: 0, sent: 0, total: 0 });
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const photoInputRef = useRef(null);
  const [showChangePw, setShowChangePw] = useState(false);

  // ── Derive label from notary_type stored in user object ──
  // This is now reliable because login stores notary_type in localStorage
  const isPrivate = user?.notary_type === 'private';
  const notaryTypeLabel = isPrivate ? 'Private Notary' : 'Sector Notary';

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`lpes_photo_notary_${user.id}`);
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
    fetch(`${API}/notary/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); })
      .catch(() => { });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      fetch(`${API}/notary/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) })
        .then(r => r.json()).then(d => { if (d.success) setStats(d.stats); }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (!user) return (
    <div className="lpes-loading-screen">
      <div className="lpes-spinner" />
      <span>Loading…</span>
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
      localStorage.setItem(`lpes_photo_notary_${user.id}`, data);
      addAlert('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  const initials = user?.name?.split(' ').filter(Boolean).slice(0,2).map(n => n[0]?.toUpperCase()).join('') || (isPrivate ? 'PN' : 'SN');

  const TITLES = {
    dashboard: 'My Dashboard',
    requests: 'Notary Requests',
    records: 'Recorded Deeds',
    reports: 'Reports',
    pricechek: 'Price Check',
  };

  function renderContent() {
    switch (active) {
      case 'dashboard': return <ViewDashboard setActive={setActive} stats={stats} user={user} />;
      case 'requests': return <ViewRequests user={user} addAlert={addAlert} />;
      case 'records': return <ViewRecords user={user} addAlert={addAlert} />;
      case 'reports': return <ViewReports user={user} addAlert={addAlert} />;
      case 'pricechek': return <ViewPriceCheck addAlert={addAlert} />;
      default: return <ViewDashboard setActive={setActive} stats={stats} user={user} />;
    }
  }

  return (
    <>
      <Head>
        <title>{TITLES[active] || 'Dashboard'} — {notaryTypeLabel} · LPES</title>
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
        :root{
          --teal:#0d9488;--teal-d:#0f766e;--teal-l:#f0fdfa;
          --cyan:#0891b2;--dark:#0c1a19;
          --g200:#ccf2ee;--g300:#99e6de;--g600:#4d7c77;
          --sh-sm:0 1px 3px rgba(13,148,136,.12);
          --sh-md:0 4px 12px rgba(13,148,136,.16);
          --sh-xl:0 20px 50px rgba(13,148,136,.24);
          --r:12px;--rl:16px;--rxl:22px;
          --sb-w:260px;--nav:#0f172a;
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:"Times New Roman",Times,serif;background:#f0fdfa;color:#0c1a19}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .shell{display:flex;flex-direction:column;height:100vh;overflow:hidden}
        .shell-body{display:flex;flex:1;overflow:hidden;min-height:0}
        .topbar{height:60px;background:var(--nav);display:flex;align-items:center;flex-shrink:0;z-index:200;border-bottom:1px solid rgba(255,255,255,.07);padding:0;}
        .topbar-brand{width:var(--sb-w);flex-shrink:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;background:#00102a;border-bottom:3px solid white;border-radius:0 0 10px 10px;}
        .topbar-brand-acronym{font-size:20px;font-weight:800;color:#60a5fa;font-family:"Times New Roman",Times,serif;letter-spacing:5px;font-style:italic;line-height:1.2;text-align:center;}
        .topbar-brand-tagline{font-size:9px;color:rgba(255,255,255,.6);font-family:"Times New Roman",Times,serif;margin-top:4px;text-align:center;letter-spacing:.1px;font-style:italic;}
        .topbar-expand-wrap{padding:0;flex-shrink:0;height:100%;}
        .topbar-expand-btn{display:flex;align-items:center;justify-content:center;height:100%;width:80px;background:white;border:none;border-right:1px solid #e5e7eb;color:#374151;cursor:pointer;transition:background .15s;border-radius:0;padding-top:6px;}
        .topbar-expand-btn:hover{background:#f3f4f6}
        .topbar-title{flex:1;font-size:14px;color:rgba(255,255,255,.65);font-family:"Times New Roman",Times,serif;font-style:italic;padding:0 16px;}
        .topbar-user {
  display: flex;
  align-items: center;
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
        .topbar-user:hover {
  background: #f9fafb;
  border-color: #0d9488;
  box-shadow: 0 2px 8px rgba(13,148,136,0.15);
}
  .topbar-user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0d9488, #0891b2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
  overflow: hidden;
}

.topbar-user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.topbar-user-name {
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
  font-family: "Times New Roman", Times, serif;
  line-height: 1.3;
}
  .topbar-user-role {
  font-size: 10px;
  font-weight: 600;
  color: #0d9488;
  font-family: "Times New Roman", Times, serif;
  letter-spacing: 0.2px;
  background: rgba(13,148,136,0.1);
  padding: 2px 8px;
  border-radius: 20px;
}
        .topbar-sep{color:#9ca3af;font-size:13px;margin:0 2px}
        .topbar-role {
        color: #6b7280;
        font-size: 11px;
        font-family: "Times New Roman", Times, serif;
        }
        .topbar-chev {
  color: #9ca3af;
  display: flex;
  align-items: center;
  margin-left: 4px;
  transition: transform 0.2s ease;
}
  .topbar-user:hover .topbar-chev {
  color: #0d9488;
}
  /* 1. Center the wrapper */
.topbar-user-wrap {
  position: relative;
  padding: 0 20px;
  flex-shrink: 0;
  overflow: visible;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);

  left: 50%;              /* move to center */
  right: auto;            
  transform: translateX(-50%);  /* perfectly center */

  width: 220px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0,0,0,.15);
  border: 1px solid rgba(13,148,136,.2);
  overflow: hidden;
  z-index: 500;
}

.user-dropdown::before {
  content: '';
  position: absolute;
  top: -8px;

  left: 50%;                 /* center arrow */
  right: auto;
  transform: translateX(-50%) rotate(45deg);

  width: 16px;
  height: 16px;
  background: white;
  border-left: 1px solid rgba(13,148,136,.2);
  border-top: 1px solid rgba(13,148,136,.2);
}
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
        .sb-nav{flex:1;padding:14px 10px;overflow-y:auto;overflow-x:hidden}
        .sb-section{font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;padding:0 8px 10px;letter-spacing:.6px;white-space:nowrap}
        .sb-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:10px;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:13px;font-weight:500;cursor:pointer;margin-bottom:3px;font-family:"Times New Roman",Times,serif;text-align:left;transition:all .18s;white-space:nowrap}
        .sb-item:hover{background:rgba(255,255,255,.06);color:white} .sb-item.active{background:rgba(13,148,136,.2);color:#0d9488}
        .sb-icon{display:flex;align-items:center;flex-shrink:0} .sb-label{flex:1} .sb-pip{width:5px;height:5px;border-radius:50%;background:#0d9488;flex-shrink:0}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .content{flex:1;overflow-y:auto;padding:24px;padding-bottom:40px;}
        .content::-webkit-scrollbar{width:5px} .content::-webkit-scrollbar-thumb{background:#0d9488;border-radius:3px}
        .view{display:flex;flex-direction:column;gap:18px;max-width:1100px;margin:0 auto;width:100%;padding-bottom:20px;}
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .stat-card{background:white;border:1px solid var(--g200);border-radius:var(--rxl);padding:18px;box-shadow:var(--sh-sm)} .stat-card.clickable:hover{transform:translateY(-2px);box-shadow:var(--sh-md);border-color:var(--teal);cursor:pointer}
        .stat-value{font-size:30px;font-weight:800;color:#0c1a19} .stat-label{font-size:13px;font-weight:600;margin-top:4px} .stat-sub{font-size:11px;color:#4d7c77;margin-top:2px}
        .section-label{font-size:11px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .qa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .qa-card{background:white;border:1.5px solid var(--g200);border-radius:var(--rxl);padding:18px;cursor:pointer;text-align:left;transition:all .2s;font-family:"Times New Roman",Times,serif}
        .qa-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-md)}
        .qa-dot{width:10px;height:10px;border-radius:50%;margin-bottom:8px} .qa-label{font-size:14px;font-weight:700} .qa-desc{font-size:12px;color:#4d7c77;margin-top:4px}
        .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:visible;animation:fadeUp .4s ease}
        .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:14px 20px;font-family:"Times New Roman",Times,serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:var(--rxl) var(--rxl) 0 0}
        .btn-p{display:flex;align-items:center;gap:7px;padding:11px 18px;font-size:14px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap}
        .btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:var(--sh-md)} .btn-p:disabled{opacity:.7;cursor:not-allowed}
        .btn-pred{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px 20px 16px;width:calc(100% - 40px);padding:13px;font-size:15px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#7c3aed,#0d9488);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .3s}
        .btn-pred:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.3)} .btn-pred:disabled{opacity:.7;cursor:not-allowed}
        .info-banner{display:flex;gap:12px;align-items:center;background:var(--teal-l);border:1px solid var(--g200);border-radius:var(--rl);padding:12px 16px;margin-bottom:14px;font-size:13px}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-group{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
        .form-label{font-size:10px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .f-inp{padding:11px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%}
        .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white}
        textarea.f-inp{resize:vertical}
        .upload-zone{border:1.5px dashed var(--g300);border-radius:var(--rl);padding:16px;text-align:center;cursor:pointer;transition:all .2s;background:white}
        .upload-zone:hover{border-color:var(--teal);background:rgba(13,148,136,.03)}
        .data-table{width:100%;border-collapse:collapse}
        .data-table th{text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#4d7c77;background:#f9fefd;border-bottom:1px solid var(--g200);white-space:nowrap}
        .data-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0fdfa;vertical-align:middle}
        .data-table tr:last-child td{border-bottom:none}
        .data-table tbody tr:hover{background:#f9fefd}
        .empty-state{padding:32px;text-align:center;color:#4d7c77;font-size:14px}
        .loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#4d7c77}
        .m-overlay{position:fixed;inset:0;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
        .m-box{background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);width:100%;max-width:420px;position:relative}
        .m-animate{animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both}
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
          <div className="topbar-brand">
            <div className="topbar-brand-acronym">L P E S</div>
            <div className="topbar-brand-tagline">Land Price Estimation System</div>
          </div>
          <div className="topbar-expand-wrap">
            <button className="topbar-expand-btn" onClick={() => setSidebarOpen(o => !o)}>
              <Ic.Menu />
            </button>
          </div>
          <div className="topbar-title">
            A Machine Learning-Based Framework for Land Price Estimation
          </div>
          <div className="topbar-user-wrap" ref={userMenuRef} style={{ paddingRight: 16, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="topbar-user" onClick={() => setUserMenuOpen(o => !o)}>
            <div className="topbar-user-avatar">
              {profilePhoto
              ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials}
            </div>
            <span className="topbar-user-name">{user?.name}</span>
            <span className="topbar-sep">|</span>
            <span className="topbar-role">
              {user?.sector_name ? `Sector: ${user.sector_name}` : (isPrivate ? 'Private Notary' : 'Sector Notary')}
            </span>
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
                  <div className="ud-role">{notaryTypeLabel}</div>
                  {user?.email && <div className="ud-email">{user.email}</div>}
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
          <div className="main">
            <div className="content">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}