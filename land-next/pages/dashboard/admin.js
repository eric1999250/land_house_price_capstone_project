// ============================================================
// ADMIN DASHBOARD — pages/dashboard/admin.js
// FIXED: Notaries split into "Sector Notaries" + "Private Notaries" (separate nav + views)
// FIXED: Dashboard stats show separate sector/private notary counts
// FIXED: All Users tab correctly counts sector officers
// ============================================================
import Head from 'next/head';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

const API = 'https://land-price-api-35fr.onrender.com';

// ── Event Bus ──
const eventBus = {
  listeners: {},
  emit(event, data) { if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data)); },
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }
};

// ── Alerts ──
function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const addAlert = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setAlerts(prev => [...prev, { id, message, type }]);
    if (duration > 0) setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), duration);
  }, []);
  const removeAlert = useCallback(id => setAlerts(prev => prev.filter(a => a.id !== id)), []);
  return { alerts, addAlert, removeAlert };
}

function ToastContainer({ alerts, removeAlert }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {alerts.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'white', boxShadow: '0 8px 24px rgba(13,148,136,.18)', borderLeft: `4px solid ${a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b'}`, animation: 'fadeUp .3s ease' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: a.type === 'success' ? 'rgba(13,148,136,.1)' : a.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b' }}>{a.type === 'success' ? '✓' : a.type === 'error' ? '✕' : '!'}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: '"Times New Roman",Times,serif', color: '#0c1a19' }}>{a.message}</span>
          <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ title, message, detail, confirmText, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="m-overlay">
      <div className="confirm-box">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', marginBottom:8 }}>
          <div className="confirm-title" style={{ margin:0 }}>{title}</div>
          <button onClick={onCancel} className="x-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="confirm-msg">{message}</div>
        {detail && <div className="confirm-detail">{detail}</div>}
        <div className="confirm-actions" style={{ marginTop:12 }}>
          <button style={{ background: confirmColor, color: 'white', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1, fontFamily: 'inherit' }} onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
}

// ── Auth ──
function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem('lpe_user');
    if (!s) { router.replace('/'); return; }
    let u;
    try { u = JSON.parse(s); } catch { router.replace('/'); return; }
    const isAdmin = u.role === 'admin' || u.role === 'system_admin';
    if (!isAdmin) {
      const map = { district_land_officer: '/dashboard/district', buyer_seller: '/dashboard/buyer', sector_land_officer: '/dashboard/sector', notary: '/dashboard/notary' };
      router.replace(map[u.role] || '/');
      return;
    }
    setUser(u);
  }, []);
  return { user };
}

const fmtDate = s => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const validateEmail = email => {
  const lower = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower)) return false;
  return [/^[^\s@]+@gmail\.com$/, /^[^\s@]+@yahoo\.[a-z.]{2,}$/, /^[^\s@]+@outlook\.com$/, /^[^\s@]+@hotmail\.com$/, /^[^\s@]+@icloud\.com$/, /^[^\s@]+@protonmail\.com$/, /^[^\s@]+@.*\.rw$/].some(p => p.test(lower));
};

const validatePhone = phone => {
  const p = phone.replace(/[\s\-]/g, '');
  const withCode = /^\+2507[0-9]{8}$/.test(p);
  const withZero = /^07[0-9]{8}$/.test(p);
  if (!withCode && !withZero) return { ok: false, msg: 'Phone must be +250 7XX XXX XXX or 07X XXX XXXX (MTN: 078/079, TIGO: 072/073).' };
  const local = withCode ? p.slice(4) : p.slice(1);
  if (!['72','73','78','79'].includes(local.slice(0,2))) return { ok: false, msg: 'Phone prefix must be 072/073 (TIGO) or 078/079 (MTN).' };
  return { ok: true, msg: '' };
};

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

// ── Icons ──
const Ic = {
  Home:        () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  District:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/></svg>,
  Notary:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  SectorNotary:() => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="15" r="2"/><path d="M14 15h2"/></svg>,
  Monitor:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Report:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
  TrendUp:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Predict:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Settings:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Check:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  X:           () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Spin:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Add:         () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Edit:        () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Search:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Send:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Menu:        () => <svg width="22" height="18" viewBox="0 0 22 18" fill="none"><path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor"/><rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor"/><rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor"/><rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor"/></svg>,
  ChevDown:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Refresh:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  Save:        () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  MapPin:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Suggestions: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg>,
  Info:        () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Eye:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
};

// ── NAV — FIXED: Notaries split into Sector Notaries + Private Notaries ──
const NAV = [
  { id: 'dashboard',       label: 'Dashboard',          icon: 'Home'        },
  { id: 'land_parcels',    label: 'Land Parcels',        icon: 'MapPin'      },
  { id: 'users',           label: 'All Users',           icon: 'Users'       },
  { id: 'district',        label: 'District Officers',   icon: 'District'    },
  { id: 'private_notaries',label: 'Private Notaries',    icon: 'Notary'      },
  // { id: 'sector_notaries', label: 'Sector Notaries',    icon: 'Notary' },  // ← REMOVE THIS
  { id: 'locations',       label: 'Locations',           icon: 'MapPin'      },
  { id: 'stamped_records', label: 'Stamped Records',     icon: 'Notary'      },
  { id: 'transactions',    label: 'Mutations',           icon: 'Monitor'     },
  { id: 'price_trends',    label: 'Price Trends',        icon: 'Report' },
  { id: 'predict',         label: 'Land & Estimation',   icon: 'Predict'     },
  { id: 'suggestions',     label: 'Suggestions',         icon: 'Suggestions' },
  { id: 'reports',         label: 'Reports Inbox',       icon: 'Report'      },
  { id: 'settings',        label: 'Settings',            icon: 'Settings'    },
];

function Sidebar({ active, setActive, sidebarOpen, suggestionBadge, reportBadge, mutationBadge }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <nav className="sb-nav">
        <div className="sb-section">Navigation</div>
        {NAV.map(n => {
          const IconComp = Ic[n.icon];
          const hasBadge = (n.id === 'suggestions' && suggestionBadge) || 
                 (n.id === 'reports' && reportBadge) ||
                 (n.id === 'transactions' && mutationBadge);  // Add this line
          return (
            <button key={n.id} className={`sb-item ${active === n.id ? 'active' : ''} ${hasBadge ? 'sb-item-alert' : ''}`} onClick={() => setActive(n.id)}>
              <span className="sb-icon" style={{ position: 'relative' }}>
                {IconComp && <IconComp />}
                {hasBadge && (
                  <span style={{ position: 'absolute', top: -3, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #0f172a', animation: 'pulse 1.5s infinite' }} />
                )}
              </span>
              <span className="sb-label" style={hasBadge ? { color: '#ef4444', fontWeight: 700 } : {}}>{n.label}</span>
              {active === n.id && <span className="sb-pip" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// AddPersonModal — supports district_land_officer and private notary with proper FK IDs
function AddPersonModal({ role, notaryType, onConfirm, onCancel, addAlert }) {
  // Only District Officer and Private Notary
  const label = role === 'district_land_officer'
    ? 'District Officer'
    : 'Private Notary';

  const [form, setForm] = useState({ 
    full_name: '', email: '', password: '', phone: '', 
    license_number: '', 
    province_id: '', district_id: '', sector_id: '',
    // For display only
    district_name: '', sector_name: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);

  // Load provinces on mount
  useEffect(() => {
    fetch(`${API}/locations/provinces`)
      .then(r => r.json())
      .then(d => { if (d.success) setProvinces(d.provinces || []); })
      .catch(err => console.error('Failed to load provinces:', err));
  }, []);

  // Load districts when province_id changes
  useEffect(() => {
    if (!form.province_id) {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    fetch(`${API}/locations/districts/by-province`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ province_id: parseInt(form.province_id) })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setDistricts(d.districts || []);
        else setDistricts([]);
      })
      .catch(err => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [form.province_id]);

  // Load sectors when district_id changes (for Private Notary)
  useEffect(() => {
    if (!form.district_id) {
      setSectors([]);
      return;
    }
    setLoadingSectors(true);
    fetch(`${API}/locations/sectors/by-district`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district_id: parseInt(form.district_id) })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSectors(d.sectors || []);
        } else {
          // Fallback: try all sectors endpoint
          fetch(`${API}/locations/sectors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          })
            .then(r => r.json())
            .then(d2 => {
              if (d2.success) {
                const filtered = (d2.sectors || []).filter(s => s.district_id === parseInt(form.district_id));
                setSectors(filtered);
              }
            })
            .catch(() => setSectors([]));
        }
      })
      .catch(err => setSectors([]))
      .finally(() => setLoadingSectors(false));
  }, [form.district_id]);

  const validateEmail = (email) => {
    const lower = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower)) return false;
    return [/^[^\s@]+@gmail\.com$/, /^[^\s@]+@yahoo\.[a-z.]{2,}$/, /^[^\s@]+@outlook\.com$/, /^[^\s@]+@hotmail\.com$/, /^[^\s@]+@icloud\.com$/, /^[^\s@]+@protonmail\.com$/, /^[^\s@]+@.*\.rw$/].some(p => p.test(lower));
  };

  const validatePhone = (phone) => {
    const p = phone.replace(/[\s\-]/g, '');
    const withCode = /^\+2507[0-9]{8}$/.test(p);
    const withZero = /^07[0-9]{8}$/.test(p);
    if (!withCode && !withZero) return { ok: false, msg: 'Phone must be +250 7XX XXX XXX or 07X XXX XXXX (MTN: 078/079, TIGO: 072/073).' };
    const local = withCode ? p.slice(4) : p.slice(1);
    if (!['72','73','78','79'].includes(local.slice(0,2))) return { ok: false, msg: 'Phone prefix must be 072/073 (TIGO) or 078/079 (MTN).' };
    return { ok: true, msg: '' };
  };

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

  const h = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    
    if (name === 'email') setErrors(ev => ({ ...ev, email: validateEmail(value) ? '' : 'Use Gmail, Yahoo, Outlook, or a .rw email.' }));
    if (name === 'phone') { const r = validatePhone(value); setErrors(ev => ({ ...ev, phone: r.ok ? '' : r.msg })); }
    if (name === 'password') { const r = validatePassword(value, form.full_name, form.email); setErrors(ev => ({ ...ev, password: r.ok ? '' : r.msg })); }
    
    if (name === 'province_id') {
      setForm(f => ({ ...f, province_id: value, district_id: '', district_name: '', sector_id: '', sector_name: '' }));
    }
    if (name === 'district_id') {
      const selectedDistrict = districts.find(d => String(d.id) === String(value));
      setForm(f => ({ ...f, district_id: value, district_name: selectedDistrict?.name || '', sector_id: '', sector_name: '' }));
    }
    if (name === 'sector_id') {
      const selectedSector = sectors.find(s => String(s.id) === String(value));
      setForm(f => ({ ...f, sector_id: value, sector_name: selectedSector?.name || '' }));
    }
  };

  async function submit(e) {
    e.preventDefault();
    const emailErr = validateEmail(form.email) ? '' : 'Use Gmail, Yahoo, Outlook, or a .rw email.';
    const phoneRes = validatePhone(form.phone);
    const pwRes    = validatePassword(form.password, form.full_name, form.email);
    const newErrs  = { email: emailErr, phone: phoneRes.ok ? '' : phoneRes.msg, password: pwRes.ok ? '' : pwRes.msg };
    
    if (role === 'district_land_officer') {
      if (!form.district_id) {
        newErrs.district = 'Please select a district';
      }
    }
    if (role === 'notary' && notaryType === 'private') {
      if (!form.district_id) newErrs.district = 'Please select a district';
      if (!form.sector_id) newErrs.sector = 'Please select a sector';
    }
    
    setErrors(newErrs);
    if (Object.values(newErrs).some(Boolean)) return;
    
    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone ? '+250' + form.phone : '',
        role: role,
        sex: '',
        national_id: '',
      };
      
      // CRITICAL FIX: Send IDs, not names
      if (role === 'district_land_officer') {
        payload.district_id = parseInt(form.district_id);
        payload.district_name = form.district_name; // Keep for display
      }
      
      if (role === 'notary' && notaryType === 'private') {
        payload.notary_type = notaryType;
        payload.district_id = parseInt(form.district_id);
        payload.district_name = form.district_name;
        payload.sector_id = parseInt(form.sector_id);
        payload.sector_name = form.sector_name;
        if (form.license_number) payload.license_number = form.license_number;
      }

      const r = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      
      if (d.success) {
        const newUserId = d.user_id || d.id || d.data?.id || d.data?.user_id;
        if (newUserId) {
          await fetch(`${API}/admin/users/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: newUserId, status: 'approved' })
          });
        }
        addAlert(`${label} added & approved!`, 'success');
        eventBus.emit('userChanged', { action: 'add', role });
        onConfirm();
      } else {
        addAlert(d.message || 'Failed', 'error');
      }
    } catch (err) { 
      console.error('Submit error:', err);
      addAlert('Cannot connect', 'error'); 
    }
    setLoading(false);
  }

  return (
    <div className="m-overlay">
      <div className="m-box" style={{ maxWidth: 480, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Add {label}</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Register and auto-approve</div>
          </div>
          <button className="modal-close" onClick={onCancel}><Ic.X /></button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Basic fields */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Full Name *</label>
              <input className="f-inp" name="full_name" value={form.full_name} onChange={h} placeholder="Full Name" required />
            </div>
            
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Email *</label>
              <input className="f-inp" name="email" value={form.email} onChange={h} placeholder="officer@example.rw" type="email" required />
              {errors.email && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.email}</div>}
              {!errors.email && form.email && validateEmail(form.email) && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Valid email</div>}
            </div>
            
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Password *</label>
              <input className="f-inp" name="password" value={form.password} onChange={h} placeholder="Min 8 chars" type="password" required />
              {errors.password && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.password}</div>}
              {!errors.password && form.password && validatePassword(form.password, form.full_name, form.email).ok && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Strong password</div>}
            </div>
            
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Phone (optional)</label>
              <div style={{ display:'flex', alignItems:'stretch', border:'1.5px solid var(--g200)', borderRadius:'var(--rl)', overflow:'hidden', background:'var(--teal-l)', transition:'border-color .22s,box-shadow .22s' }}
                onFocusCapture={e => { e.currentTarget.style.borderColor='var(--teal)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(13,148,136,.1)'; e.currentTarget.style.background='white'; }}
                onBlurCapture={e => { e.currentTarget.style.borderColor='var(--g200)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='var(--teal-l)'; }}>
                <span style={{ display:'flex', alignItems:'center', padding:'0 10px 0 13px', fontSize:13, fontWeight:700, color:'var(--teal)', whiteSpace:'nowrap', userSelect:'none' }}>+250</span>
                <input
                  style={{ flex:1, padding:'10px 13px', fontSize:13, fontFamily:'"Times New Roman",Times,serif', background:'transparent', border:'none', outline:'none', color:'var(--dark)', minWidth:0 }}
                  name="phone"
                  type="text"
                  inputMode="numeric"
                  placeholder="7XXXXXXXXX"
                  value={form.phone}
                  maxLength={9}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setForm(f => ({ ...f, phone: digits }));
                    const normalized = '0' + digits;
                    const withCode = /^\+2507[0-9]{8}$/.test('+250' + digits);
                    const withZero = /^07[0-9]{8}$/.test(normalized);
                    if (digits && !withCode && !withZero) {
                      setErrors(ev => ({ ...ev, phone: 'Phone prefix must be 72/73 (TIGO) or 78/79 (MTN).' }));
                    } else {
                      setErrors(ev => ({ ...ev, phone: '' }));
                    }
                  }}
                />
              </div>
              {errors.phone && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.phone}</div>}
              {!errors.phone && form.phone && form.phone.length === 9 && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Valid phone number (+250{form.phone})</div>}
            </div>

            {/* License Number for Private Notary */}
            {role === 'notary' && notaryType === 'private' && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>License Number *</label>
                <input className="f-inp" name="license_number" value={form.license_number} onChange={h} placeholder="NTR-2024-001" />
              </div>
            )}

            {/* District Officer: Province + District */}
            {role === 'district_land_officer' && (
              <>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Province *</label>
                  <select className="f-inp" name="province_id" value={form.province_id} onChange={h} required>
                    <option value="">— Select Province —</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>District *</label>
                  <select className="f-inp" name="district_id" value={form.district_id} onChange={h} required disabled={!form.province_id || loadingDistricts}>
                    <option value="">— Select District —</option>
                    {loadingDistricts && <option disabled>Loading districts...</option>}
                    {!loadingDistricts && districts.length === 0 && form.province_id && <option disabled>No districts found</option>}
                    {!loadingDistricts && districts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {errors.district && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.district}</div>}
                </div>
              </>
            )}

            {/* Private Notary: Province → District → Sector */}
            {role === 'notary' && notaryType === 'private' && (
              <>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Province *</label>
                  <select className="f-inp" name="province_id" value={form.province_id} onChange={h} required>
                    <option value="">— Select Province —</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>District *</label>
                  <select className="f-inp" name="district_id" value={form.district_id} onChange={h} required disabled={!form.province_id || loadingDistricts}>
                    <option value="">— Select District —</option>
                    {loadingDistricts && <option disabled>Loading districts...</option>}
                    {!loadingDistricts && districts.length === 0 && form.province_id && <option disabled>No districts found</option>}
                    {!loadingDistricts && districts.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {errors.district && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.district}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Sector *</label>
                  <select className="f-inp" name="sector_id" value={form.sector_id} onChange={h} required disabled={!form.district_id || loadingSectors}>
                    <option value="">— Select Sector —</option>
                    {loadingSectors && <option disabled>Loading sectors...</option>}
                    {!loadingSectors && sectors.length === 0 && form.district_id && <option disabled>No sectors found</option>}
                    {!loadingSectors && sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {errors.sector && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.sector}</div>}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 6, marginBottom: 8 }}>
              <button className="btn-p" type="submit" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Add /> Add {label}</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Edit User Modal ──
function EditUserModal({ user: u, onConfirm, onCancel, addAlert }) {
  const [form, setForm] = useState({ full_name: u.full_name || '', email: u.email || '', phone: u.phone || '' });
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/users/edit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id, ...form }) });
      const d = await r.json();
      if (d.success) { addAlert(`${form.full_name} updated!`, 'success'); eventBus.emit('userChanged', { action: 'edit' }); onConfirm(form); }
      else addAlert(d.message || 'Update failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }
  return (
    <div className="m-overlay">
      <div className="m-box">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, fontFamily:'"Times New Roman",Times,serif' }}>Edit User</div>
            <div style={{ fontSize:12, color:'#4d7c77' }}>{u.email}</div>
          </div>
          <button className="modal-close" onClick={onCancel}><Ic.X /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[['full_name','Full Name'],['email','Email'],['phone','Phone']].map(([n,l]) => (
            <div key={n}>
              <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>{l}</label>
              <input className="f-inp" value={form[n]} onChange={e => setForm(f => ({ ...f, [n]: e.target.value }))} required={n !== 'phone'} />
            </div>
          ))}
          <div style={{ display:'flex', gap:10, marginTop:6 }}>
            <button className="btn-p" onClick={submit} disabled={loading} style={{ flex:1, justifyContent:'center' }}>
              {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard View — FIXED: separate sector/private notary counts ──
function ViewDashboard({ setActive, stats }) {
  return (
    <div className="view">
      <div className="stats-grid">
        {[
          { label: 'Total Users',         value: stats.total           ?? 0, color: '#0d9488', sub: 'registered accounts', clickable: true, target: 'users' },
          { label: 'District Officers',   value: stats.district        ?? 0, color: '#0891b2', sub: 'active officers',     clickable: true, target: 'district' },
          // FIXED: Show sector and private notaries separately
          { label: 'Private Notaries',    value: stats.notary_private  ?? 0, color: '#a855f7', sub: 'private notaries',    clickable: true, target: 'private_notaries' },
          { label: 'Mutations',           value: stats.txs             ?? 0, color: '#f59e0b', sub: 'transactions',         clickable: true, target: 'transactions' },
          { label: 'Stamped Records',     value: stats.stamped_records ?? 0, color: '#6366f1', sub: 'stamped documents',    clickable: true, target: 'stamped_records' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.clickable ? 'clickable' : ''}`} style={{ '--c': s.color, cursor: s.clickable ? 'pointer' : 'default' }} onClick={() => s.clickable && setActive(s.target)}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="section-label">QUICK ACTIONS</div>
      <div className="qa-grid">
        {[
          { label: 'Manage Users',        desc: 'View, edit, delete all system users',      id: 'users',           color: '#0d9488' },
          { label: 'District Officers',   desc: 'Add & manage district officers',           id: 'district',        color: '#0891b2' },
          { label: 'Private Notaries',    desc: 'Add & manage private notaries',            id: 'private_notaries',color: '#a855f7' },
          { label: 'Mutations',           desc: 'View all system mutation records',         id: 'transactions',    color: '#f59e0b' },
          { label: 'Stamped Records',     desc: 'View, edit & delete notary stamped data',  id: 'stamped_records', color: '#6366f1' },
          { label: 'Land & Estimation',   desc: 'Search parcels & estimate land prices',   id: 'predict',         color: '#10b981' },
          { label: 'Reports Inbox',       desc: 'Reports forwarded from district',         id: 'reports',         color: '#7c3aed' },
          { label: 'Suggestions',         desc: 'Read feedback from buyers & sellers',     id: 'suggestions',     color: '#22c55e' },
          { label: 'Land Parcels',        desc: 'Register & manage UPIs for users',        id: 'land_parcels',    color: '#0891b2' },
          { label: 'Settings',            desc: 'Configure system parameters',             id: 'settings',        color: '#e11d48' },
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

// ── All Users View — includes Sector Officers tab ──
function ViewUsers({ addAlert }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
const [docsModal, setDocsModal] = useState(null);
const [docsData, setDocsData] = useState(null);
const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeRole, setActiveRole] = useState('all');

  const ROLES = [
    { id: 'all',                   label: 'All Users'        },
    { id: 'district_land_officer', label: 'District Officers'},
    { id: 'notary_sector',         label: 'Sector Notaries'  },
    { id: 'notary_private',        label: 'Private Notaries' },
    { id: 'buyer_seller',          label: 'Buyers/Sellers'   },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const d = await r.json();
      if (d.success) setUsers(d.users || []);
      else addAlert(d.message || 'Failed to load users', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [addAlert]);

  async function doDelete(u) {
    setConfirmDelete(null);
    try {
      await fetch(`${API}/admin/users/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) });
      load();
      addAlert(`${u.full_name} deleted.`, 'success');
      eventBus.emit('userChanged', { action: 'delete' });
    } catch { addAlert('Delete failed', 'error'); }
  }

  useEffect(() => {
    load();
    const unsub = eventBus.on('userChanged', () => load());
    return () => unsub();
  }, [load]);

  const roleLabel  = r => ({ system_admin:'Admin', admin:'Admin', district_land_officer:'District Officer', sector_land_officer:'Sector Officer', notary:'Notary', buyer_seller:'Buyer/Seller' }[r] || r);
  const statusColor= s => ({ approved:'#0d9488', pending:'#f59e0b', suspended:'#ef4444' }[s] || '#94a3b8');
  const roleColor  = r => ({ district_land_officer:'#0891b2', sector_land_officer:'#22c55e', notary:'#8b5cf6', buyer_seller:'#f59e0b', system_admin:'#0d9488', admin:'#0d9488' }[r] || '#64748b');

  const filtered = users.filter(u => {
    if (u.role === 'system_admin' || u.role === 'admin') return false;
    if (activeRole === 'notary_sector'  && !(u.role === 'notary' && u.notary_type === 'sector'))  return false;
    if (activeRole === 'notary_private' && !(u.role === 'notary' && u.notary_type === 'private')) return false;
    if (activeRole !== 'all' && activeRole !== 'notary_sector' && activeRole !== 'notary_private' && u.role !== activeRole) return false;
    if (search) { const q = search.toLowerCase(); return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q); }
    return true;
  });

  return (
    <div className="view">
      {editModal && <EditUserModal user={editModal} addAlert={addAlert} onConfirm={f => { setUsers(prev => prev.map(u => u.id === editModal.id ? { ...u, ...f } : u)); setEditModal(null); }} onCancel={() => setEditModal(null)} />}
      {confirmDelete && <ConfirmDialog title="Delete User" message={`Delete ${confirmDelete.full_name}?`} detail="This cannot be undone." confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Users /> System Users ({filtered.length})</span>
          <div className="search-wrap-inline">
            <Ic.Search />
            <input 
            className="s-inp-sm" 
            placeholder="Search name or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ color: '#0c1a19', caretColor: '#0c1a19' }}
            />
          </div>
        </div>
        <div style={{ padding:'12px 20px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
          {ROLES.map(role => (
            <button key={role.id} className={`role-tab ${activeRole === role.id ? 'active' : ''}`} onClick={() => setActiveRole(role.id)}>
              {role.label}
              <span className="tab-count">
                {role.id === 'all'
                  ? users.filter(u => u.role !== 'system_admin' && u.role !== 'admin').length
                  : role.id === 'notary_sector'
                    ? users.filter(u => u.role === 'notary' && u.notary_type === 'sector').length
                    : role.id === 'notary_private'
                      ? users.filter(u => u.role === 'notary' && u.notary_type === 'private').length
                      : users.filter(u => u.role === role.id).length}
              </span>
            </button>
          ))}
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading users…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No users found{search ? ' matching your search' : ''}.</div>}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX:'auto', margin:'14px 0 0' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td><div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${roleColor(u.role)},${roleColor(u.role)}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>{u.full_name?.[0]?.toUpperCase()}</div><strong style={{ fontSize:13 }}>{u.full_name}</strong></div></td>
                    <td style={{ fontSize:12, fontFamily:'monospace' }}>{u.email}</td>
                    <td>
                      <span className="role-chip" style={{ background:`${roleColor(u.role)}18`, color:roleColor(u.role), border:`1px solid ${roleColor(u.role)}30` }}>
                        {roleLabel(u.role)}{u.role === 'notary' && u.notary_type ? ` (${u.notary_type})` : ''}
                      </span>
                    </td>
                    <td><span style={{ fontSize:12, fontWeight:700, color:statusColor(u.status) }}>● {u.status}</span></td>
                    <td style={{ fontSize:12, color:'#4d7c77' }}>{fmtDate(u.created_at)}</td>
                    <td><div style={{ display:'flex', gap:6 }}><button className="tbl-btn tbl-edit" onClick={() => setEditModal(u)}><Ic.Edit /> Edit</button><button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(u)}><Ic.Trash /></button></div></td>
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

// ── Role Management — FIXED: notaries now filtered by notary_type ──
function ViewRoleManagement({ role, notaryType, accentColor, addAlert }) {
  // notaryType = 'sector' | 'private' | undefined (for district officers)
  const isNotary = role === 'notary';
  const label = role === 'district_land_officer'
    ? 'District Officer'
    : notaryType === 'sector' ? 'Sector Notary' : 'Private Notary';
  const labelPlural = role === 'district_land_officer'
    ? 'District Officers'
    : notaryType === 'sector' ? 'Sector Notaries' : 'Private Notaries';

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // FIXED: pass notary_type when fetching notaries so backend filters correctly
      const body = { role };
      if (isNotary && notaryType) body.notary_type = notaryType;
      // notary_type ensures sector notaries and private notaries are separate lists

      const r = await fetch(`${API}/admin/users/by-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (d.success) setPeople(d.users || []);
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [role, notaryType, addAlert]);

  async function approve(p) {
    try {
      await fetch(`${API}/admin/users/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id, status: 'approved' }) });
      setPeople(prev => prev.map(x => x.id === p.id ? { ...x, status: 'approved' } : x));
      addAlert(`${p.full_name} approved!`, 'success');
      eventBus.emit('userChanged', { action: 'approve', role });
    } catch { addAlert('Action failed', 'error'); }
  }

  async function doDelete(p) {
    setConfirmDelete(null);
    try {
      await fetch(`${API}/admin/users/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id }) });
      load();
      addAlert(`${p.full_name} removed.`, 'success');
      eventBus.emit('userChanged', { action: 'delete', role });
    } catch { addAlert('Delete failed', 'error'); }
  }

  useEffect(() => {
    load();
    const unsub = eventBus.on('userChanged', (data) => { if (!data.role || data.role === role) load(); });
    return () => unsub();
  }, [load, role]);

  const pending  = people.filter(p => p.status === 'pending');
  const approved = people.filter(p => p.status === 'approved');

  return (
    <div className="view">
      {showAdd && (
        <AddPersonModal
          role={role}
          notaryType={notaryType}
          addAlert={addAlert}
          onConfirm={() => { setShowAdd(false); load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {confirmDelete && <ConfirmDialog title={`Remove ${label}`} message={`Remove ${confirmDelete.full_name}?`} confirmText="Yes, Remove" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}

      {isNotary && (
        <div className="info-banner" style={{ borderColor:`${accentColor}30`, background:`${accentColor}08` }}>
          <span style={{ width:40, height:40, borderRadius:'50%', background:`${accentColor}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {notaryType === 'sector'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
          </span>
          <div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{labelPlural}</div>
            <div style={{ fontSize:12, color:'#4d7c77', lineHeight:1.6 }}>
              {notaryType === 'sector'
                ? 'Sector Notaries are government-employed notaries at the sector level. They can certify land mutation deeds for transactions in their sector. They cannot add or edit land data.'
                : 'Private Notaries are independent legal professionals who certify land mutation deeds. Adding them here registers and auto-approves them so they can immediately process mutations.'}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:`linear-gradient(135deg,${accentColor},${accentColor}bb)` }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Notary /> {labelPlural} ({people.length})</span>
          <button className="btn-p" onClick={() => setShowAdd(true)} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)' }}>
            <Ic.Add /> Add {label}
          </button>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && pending.length > 0 && (
          <div style={{ padding:'0 20px 12px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', textTransform:'uppercase', letterSpacing:'.4px', padding:'14px 0 8px', display:'flex', alignItems:'center', gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Pending Approval ({pending.length})
            </div>
            {pending.map(p => (
              <div key={p.id} className="officer-card pending-card">
                <div className="oc-avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>{p.full_name?.[0]}</div>
                <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:14 }}>{p.full_name}</div><div style={{ fontSize:12, color:'#4d7c77', marginTop:2 }}>{p.email}{p.district_name ? ` · ${p.district_name}` : ''}{p.sector_name ? ` · ${p.sector_name}` : ''} · Joined {fmtDate(p.created_at)}</div></div>
                <button className="tbl-btn tbl-approve" onClick={() => approve(p)}><Ic.Check /> Approve</button>
              </div>
            ))}
          </div>
        )}
        {!loading && approved.length > 0 && (
          <div style={{ padding:'0 20px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:accentColor, textTransform:'uppercase', letterSpacing:'.4px', padding:'14px 0 8px' }}>✓ Active {labelPlural} ({approved.length})</div>
            {approved.map(p => (
              <div key={p.id} className="officer-card" style={{ borderLeft:`3px solid ${accentColor}` }}>
                <div className="oc-avatar" style={{ background:`linear-gradient(135deg,${accentColor},${accentColor}99)` }}>{p.full_name?.[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{p.full_name}</div>
                  <div style={{ fontSize:12, color:'#4d7c77', marginTop:2 }}>
                    {p.email}
                    {p.district_name ? ` · District: ${p.district_name}` : ''}
                    {p.sector_name ? ` · Sector: ${p.sector_name}` : ''}
                    {p.license_number ? ` · License: ${p.license_number}` : ''}
                    {` · Joined ${fmtDate(p.created_at)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && people.length === 0 && (
          <div className="empty-state">No {labelPlural.toLowerCase()} yet.<br />
            <button className="btn-p" style={{ marginTop:12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Add First {label}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stamped Records View ──
function ViewStampedRecords({ addAlert }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/stamped-records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (d.success) setRecords(d.records || []);
      else addAlert(d.message || 'Failed to load records', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [addAlert]);

  useEffect(() => { load(); }, [load]);

  async function doDelete(rec) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/stamped-records/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ record_id: rec.id }) });
      const d = await r.json();
      if (d.success) { setRecords(prev => prev.filter(x => x.id !== rec.id)); addAlert('Record deleted.', 'success'); }
      else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Delete failed', 'error'); }
  }

  async function doEdit(form) {
    try {
      const r = await fetch(`${API}/admin/stamped-records/edit`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          record_id: editModal.id, 
          ...form 
        }) 
      });
      const d = await r.json();
      if (d.success) {
        setRecords(prev => prev.map(x => x.id === editModal.id ? { ...x, ...form } : x));
        addAlert('Record updated!', 'success');
        setEditModal(null);
      } else addAlert(d.message || 'Update failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.upi?.toLowerCase().includes(q) || r.seller_name?.toLowerCase().includes(q) || r.buyer_name?.toLowerCase().includes(q) || r.cert_number?.toLowerCase().includes(q);
  });

  const fmt = v => v ? Number(v).toLocaleString() : '—';

  return (
    <div className="view">
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Stamped Record"
          message={`Delete record for UPI: ${confirmDelete.upi}?`}
          detail={`Buyer: ${confirmDelete.buyer_name} ↔ Seller: ${confirmDelete.seller_name}`}
          confirmText="Yes, Delete"
          confirmColor="#ef4444"
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {editModal && (
        <StampedEditModal
          record={editModal}
          onConfirm={doEdit}
          onCancel={() => setEditModal(null)}
          addAlert={addAlert}
        />
      )}
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Notary /> Stamped Parcel Records ({filtered.length})</span>
          <div className="search-wrap-inline"><Ic.Search /><input className="s-inp-sm" placeholder="Search UPI, buyer, seller…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading records…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No stamped records found{search ? ' matching your search' : ''}.</div>}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>UPI</th><th>Cert #</th><th>Buyer</th><th>Seller</th>
                  <th>Agreed Price</th>
                  <th>ML Min</th>
                  <th>ML Avg</th>
                  <th>ML Max</th>
                  <th>Tax</th><th>Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <>
                    <tr key={rec.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6366f1', fontSize: 12 }}>{rec.upi}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{rec.cert_number || '—'}</td>
                      <td>{rec.buyer_name}</td>
                      <td>{rec.seller_name}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(rec.agreed_price)} RWF</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(rec.ml_min_price)} RWF</td>
                      <td style={{ color: '#0891b2', fontWeight: 600 }}>{fmt(rec.ml_avg_price)} RWF</td>
                      <td style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt(rec.ml_max_price)} RWF</td>
                      <td style={{ color: rec.capital_gains_tax > 0 ? '#ef4444' : '#16a34a', fontSize: 12 }}>
                        {rec.capital_gains_tax > 0 ? fmt(rec.capital_gains_tax) + ' RWF' : 'No Tax'}
                      </td>
                      <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(rec.stamped_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="tbl-btn tbl-edit" onClick={() => setEditModal(rec)}><Ic.Edit /> Edit</button>
                          <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(rec)}><Ic.Trash /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded === rec.id && (
                      <tr key={`${rec.id}-exp`}>
                        <td colSpan={9} style={{ padding: '0 0 12px', background: '#f9fefd' }}>
                          <div style={{ margin: '0 16px', padding: '14px 18px', background: 'white', border: '1px solid #ccf2ee', borderRadius: 12, animation: 'fadeUp .2s ease' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', marginBottom: 12 }}>Full Parcel Details</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
                              {[
                                ['Province', rec.province], ['District', rec.district], ['Sector', rec.sector],
                                ['Cell', rec.cell], ['Village', rec.village],
                                ['Area (m²)', rec.area_m2 ? Number(rec.area_m2).toLocaleString() : '—'],
                                ['Zoning', rec.zoning], ['Zoning %', rec.zoning_percentage],
                                ['Settlement', rec.settlement], ['Settlement %', rec.settlement_percentage],
                                ['Land Use', rec.land_use],
                                ['Min Value/m²', rec.min_value_per_sqm ? fmt(rec.min_value_per_sqm) + ' RWF' : '—'],
                                ['Avg Value/m²', rec.avg_value_per_sqm ? fmt(rec.avg_value_per_sqm) + ' RWF' : '—'],
                                ['Max Value/m²', rec.max_value_per_sqm ? fmt(rec.max_value_per_sqm) + ' RWF' : '—'],
                                ['ML Min Price', rec.ml_min_price ? fmt(rec.ml_min_price) + ' RWF' : '—'],
                                ['ML Avg Price', rec.ml_avg_price ? fmt(rec.ml_avg_price) + ' RWF' : '—'],
                                ['ML Max Price', rec.ml_max_price ? fmt(rec.ml_max_price) + ' RWF' : '—'],
                                ['ML Min/m²', rec.ml_min_per_sqm ? fmt(rec.ml_min_per_sqm) + ' RWF' : '—'],
                                ['ML Avg/m²', rec.ml_avg_per_sqm ? fmt(rec.ml_avg_per_sqm) + ' RWF' : '—'],
                                ['ML Max/m²', rec.ml_max_per_sqm ? fmt(rec.ml_max_per_sqm) + ' RWF' : '—'],
                                ['Notary Type', rec.notary_type], ['Signed Date', rec.signed_date || '—'],
                                ['Cert #', rec.cert_number || '—'], ['Request Ref', rec.request_ref || '—'],
                              ].map(([label, val]) => (
                                <div key={label} style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, padding: '10px 12px' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{val ?? '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StampedEditModal({ record, onConfirm, onCancel, addAlert }) {
  const [form, setForm] = useState({
    cert_number:     record.cert_number  || '',
    signed_date:     record.signed_date  || '',
    agreed_price:    record.agreed_price || '',
    ml_min_price:    record.ml_min_price || '',
    ml_avg_price:    record.ml_avg_price || '',
    ml_max_price:    record.ml_max_price || '',
    notes:           record.notes        || '',
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await onConfirm(form);
    setLoading(false);
  }

  return (
    <div className="m-overlay">
      <style>{`
        .scrollable-form::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="m-box" style={{ maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Edit Stamped Record</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>UPI: {record.upi}</div>
          </div>
          <button className="x-close-btn" onClick={onCancel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div 
          className="scrollable-form"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 12, 
            maxHeight: '60vh', 
            overflowY: 'auto', 
            paddingRight: 4,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {[
            ['cert_number',  'Certificate Number', 'text',   'e.g. CERT-2024-001'],
            ['signed_date',  'Signed Date',        'date',   ''],
            ['agreed_price', 'Agreed Price (RWF)', 'number', 'e.g. 15000000'],
            ['ml_min_price', 'ML Min Price (RWF)', 'number', 'e.g. 12000000'],
            ['ml_avg_price', 'ML Avg Price (RWF)', 'number', 'e.g. 14000000'],
            ['ml_max_price', 'ML Max Price (RWF)', 'number', 'e.g. 16000000'],
            ['notes',        'Notes',              'text',   'Optional notes'],
          ].map(([key, label, type, placeholder]) => (
            <div key={key}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                className="f-inp"
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexShrink: 0 }}>
          <button className="btn-p" onClick={submit} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
            {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Land Parcels View (Admin registers UPIs for users) ──
function ViewLandParcels({ addAlert }) {
  const [userSearch, setUserSearch] = useState('');
  const [showUserDrop, setShowUserDrop] = useState(false);
  const [parcels, setParcels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');

  const emptyForm = {
    upi:'', user_id:'', owner_national_id:'', owner_name:'', owner_sex:'',
    province:'', district:'', sector:'',
    cell:'', village:'', x:'', y:'', area_m2:'', land_use:'',
    zoning:'', zoning_percentage:'', sentlement:'', sentlement_percentage:'',
    minimum_value_per_sqm:'', weighted_average_value_per_sqm:'', maximum_value_per_sqm:''
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [upiAutoFilled, setUpiAutoFilled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, uRes] = await Promise.all([
        fetch(`${API}/admin/land-parcels`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }),
        fetch(`${API}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }),
      ]);
      const [pData, uData] = await Promise.all([pRes.json(), uRes.json()]);
      if (pData.success) setParcels(pData.parcels || []);
      if (uData.success) {
        const buyers = (uData.users || []).filter(u => u.role === 'buyer_seller');
        // Debug: log first user to see available fields
        if (buyers.length > 0) console.log('User fields available:', Object.keys(buyers[0]), buyers[0]);
        setUsers(buyers);
      }
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [addAlert]);

  useEffect(() => { load(); }, [load]);

  const h = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleNationalIdChange(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, owner_national_id: val }));
    if (val.length === 16 && val[0] === '1') {
      const sexCode = parseInt(val.slice(5, 8), 10);
      const detectedSex = (sexCode >= 800 && sexCode <= 899) ? 'Male' : (sexCode >= 700 && sexCode <= 799) ? 'Female' : null;
      const match = users.find(u => u.national_id === val.trim());
      if (match) {
        setForm(f => ({ ...f, owner_national_id: val, user_id: match.id, owner_name: match.full_name || f.owner_name, owner_sex: detectedSex || f.owner_sex }));
        setUserSearch('');
      } else if (detectedSex) {
        // FIX: always set detected sex into the select field
        setForm(f => ({ ...f, owner_sex: detectedSex }));
      }
    }
  }

  async function handleUpiChange(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, upi: val }));
    setUpiAutoFilled(false);
    if (val.trim().length >= 8) {
      try {
        const r = await fetch(`${API}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: val.trim() }) });
        const d = await r.json();
        if (d.success) {
          const p = d.data;
          setForm(f => ({
            ...f,
            upi: val,
            province: p.Province !== 'N/A' ? p.Province : f.province,
            district: p.District !== 'N/A' ? p.District : f.district,
            sector:   p.Sector   !== 'N/A' ? p.Sector   : f.sector,
            cell:    (p.Cell    && p.Cell    !== 'N/A' && p.Cell    !== 'nan') ? p.Cell    : f.cell,
            village: (p.Village && p.Village !== 'N/A' && p.Village !== 'nan') ? p.Village : f.village,
            x: p.X_coordinate || f.x,
            y: p.Y_coordinate || f.y,
            area_m2:   p.Area    || f.area_m2,
            land_use:  p.Land_use !== 'N/A' ? p.Land_use  : f.land_use,
            zoning:    p.Zoning   !== 'N/A' ? p.Zoning    : f.zoning,
            zoning_percentage:    p['Zoning_%']     || f.zoning_percentage,
            sentlement:           p.Settlement !== 'N/A' ? p.Settlement : f.sentlement,
            sentlement_percentage: p['Settlement_%'] ?? f.sentlement_percentage,
            minimum_value_per_sqm:          p.Min_Value_Sqm || f.minimum_value_per_sqm,
            weighted_average_value_per_sqm: p.Avg_Value_Sqm || f.weighted_average_value_per_sqm,
            maximum_value_per_sqm:          p.Max_Value_Sqm || f.maximum_value_per_sqm,
          }));
          setUpiAutoFilled(true);
        }
      } catch { }
    }
  }

  async function saveParcel(isEdit = false) {
    if (!form.upi.trim())    { addAlert('UPI is required', 'error'); return; }
    if (!form.user_id)       { addAlert('Please assign to a user', 'error'); return; }
    if (!form.area_m2)       { addAlert('Area is required', 'error'); return; }
    if (!form.land_use.trim()) { addAlert('Land use is required', 'error'); return; }
    // Check duplicate UPI — only on create, or if UPI changed during edit
    if (!isEdit || (editModal && form.upi.trim() !== editModal.upi)) {
      const duplicate = parcels.find(p => p.upi?.trim() === form.upi.trim() && (!isEdit || p.id !== editModal?.id));
      if (duplicate) {
        addAlert(`UPI ${form.upi} is already assigned to ${duplicate.owner_name || 'another user'}. Each UPI can only be assigned to one user.`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/admin/land-parcels/edit` : `${API}/admin/land-parcels/create`;
      const body = isEdit ? { parcel_id: editModal.id, ...form } : { ...form };
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) {
        addAlert(isEdit ? 'Parcel updated!' : 'Parcel registered!', 'success');
        setShowAdd(false); setEditModal(null); setUserSearch(''); setShowUserDrop(false);
        setForm({ ...emptyForm }); setUpiAutoFilled(false);
        load();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setSaving(false);
  }

  async function doDelete(p) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/land-parcels/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parcel_id: p.id }) });
      const d = await r.json();
      if (d.success) { load(); addAlert('Parcel deleted.', 'success'); }
      else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Delete failed', 'error'); }
  }

  function openEdit(p) {
    setForm({
      upi: p.upi || '',
      user_id: p.owner_id || '',
      owner_national_id: p.owner_national_id || '',  // ✓ fine
      owner_name: p.owner_name || '',
      owner_sex: p.owner_sex || '',
      province: p.province || '',
      district: p.district || '',
      sector: p.sector || '',
      cell: p.cell || '',        // ✓ fine
      village: p.village || '',  // ✓ fine
      x: p.x || '',              // ✓ fine
      y: p.y || '',              // ✓ fine
      area_m2: p.area_in_meter_square || '',
      land_use: p.land_use || '',
      zoning: p.zoning || '',
      zoning_percentage: p.zoning_percentage || '',
      sentlement: p.sentlement || '',
      sentlement_percentage: p.sentlement_percentage || '',
      minimum_value_per_sqm: p.minimum_value_per_sqm || '',
      weighted_average_value_per_sqm: p.weighted_average_value_per_sqm || '',
      maximum_value_per_sqm: p.maximum_value_per_sqm || ''
    });
    setEditModal(p);
    setUpiAutoFilled(false);
    // Also show the assigned user in the search box
    setUserSearch('');
    setShowUserDrop(false);
  }

  const filtered = parcels.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.upi||'').toLowerCase().includes(q) || (p.owner_name||'').toLowerCase().includes(q);
  });

  const isEdit = !!editModal;
  const showForm = showAdd || !!editModal;
  const selectedUser = users.find(u => String(u.id) === String(form.user_id));
  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div className="view">
      {showForm && (
        <div className="m-overlay">
          <div className="m-box" style={{ maxWidth:600, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, fontFamily:'"Times New Roman",Times,serif' }}>{isEdit ? 'Edit Parcel' : 'Register New UPI'}</div>
                <div style={{ fontSize:12, color:'#4d7c77', marginTop:2 }}>{isEdit ? `UPI: ${editModal?.upi}` : 'Assign land parcel to a user'}</div>
              </div>
              <button className="x-close-btn" onClick={() => { setShowAdd(false); setEditModal(null); setForm({...emptyForm}); setUserSearch(''); setShowUserDrop(false); setUpiAutoFilled(false); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ overflowY:'auto', flex:1, paddingRight:2, scrollbarWidth:'none', msOverflowStyle:'none' }}>
              <style>{`.admin-parcel-scroll::-webkit-scrollbar{display:none}`}</style>
              <div className="admin-parcel-scroll" style={{ display:'flex', flexDirection:'column', gap:12 }}>

                {/* UPI */}
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>UPI *</label>
                  <input className="f-inp" name="upi" value={form.upi} onChange={handleUpiChange} placeholder="e.g. 2/04/07/02/669" style={{ fontFamily:'monospace' }} />
                  {upiAutoFilled && <div style={{ fontSize:11, color:'#16a34a', marginTop:3 }}>✓ Location data auto-filled from CSV</div>}
                </div>

                {/* Assign to User */}
                <div style={{ position:'relative' }}>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Assign to User *</label>
                  <div style={{ position:'relative' }}>
                    <input className="f-inp" placeholder="Search user by name or email…" value={selectedUser ? `${selectedUser.full_name} (${selectedUser.email})` : userSearch}
                      onChange={e => { setUserSearch(e.target.value); setShowUserDrop(true); setForm(f => ({ ...f, user_id: '' })); }}
                      onFocus={() => setShowUserDrop(true)} style={{ paddingRight:30 }} />
                    {form.user_id && (<button onClick={() => { setForm(f => ({ ...f, user_id:'' })); setUserSearch(''); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18, lineHeight:1 }}>×</button>)}
                  </div>
                  {showUserDrop && !form.user_id && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid #ccf2ee', borderRadius:12, zIndex:100, maxHeight:180, overflowY:'auto', boxShadow:'0 8px 24px rgba(13,148,136,.15)', scrollbarWidth:'none' }}>
                      {filteredUsers.length === 0 && <div style={{ padding:'12px 14px', fontSize:12, color:'#94a3b8' }}>No users found</div>}
                      {filteredUsers.map(u => (<div key={u.id} onClick={() => { setForm(f => ({ ...f, user_id: u.id, owner_name: u.full_name || f.owner_name, owner_national_id: u.national_id || u.owner_national_id || u.id_number || '' })); setUserSearch(''); setShowUserDrop(false); }}
                        style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0fdfa' }}
                        onMouseEnter={e => e.currentTarget.style.background='#f0fdfa'} onMouseLeave={e => e.currentTarget.style.background='white'}>
                        <span style={{ fontWeight:700 }}>{u.full_name}</span>
                        <span style={{ fontSize:11, color:'#4d7c77', fontFamily:'monospace', display:'block' }}>{u.email}</span>
                      </div>))}
                    </div>
                  )}
                </div>

                {/* Owner info */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Owner Full Name</label>
                    <input className="f-inp" name="owner_name" value={form.owner_name} onChange={h} placeholder="Full legal name" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Owner National ID</label>
                    <input className="f-inp" name="owner_national_id" value={form.owner_national_id} onChange={handleNationalIdChange} placeholder="16-digit ID" maxLength={16} style={{ fontFamily:'monospace' }} />
                    {form.owner_national_id.length === 16 && form.owner_national_id[0] === '1' && (() => {
                      const sexCode = parseInt(form.owner_national_id.slice(5,8),10);
                      const sex = (sexCode>=800 && sexCode<=899) ? 'Male' : (sexCode>=700 && sexCode<=799) ? 'Female' : null;
                      if (!sex) return null;
                      // FIX: auto-set the select if not already set
                      if (form.owner_sex !== sex) {
                        setTimeout(() => setForm(f => f.owner_sex === sex ? f : ({ ...f, owner_sex: sex })), 0);
                      }
                      return <div style={{ fontSize:11, color:'#16a34a', marginTop:3 }}>✓ Valid ID — detected sex: {sex}</div>;
                    })()}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Owner Sex</label>
                  <select className="f-inp" name="owner_sex" value={form.owner_sex} onChange={h}>
                    <option value="">— Select sex —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Province</label>
                    <input className="f-inp" name="province" value={form.province} onChange={h} placeholder="e.g. Southern" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>District</label>
                    <input className="f-inp" name="district" value={form.district} onChange={h} placeholder="e.g. Huye" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Sector</label>
                    <input className="f-inp" name="sector" value={form.sector} onChange={h} placeholder="e.g. Mbazi" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Cell</label>
                    <input className="f-inp" name="cell" value={form.cell} onChange={h} placeholder="e.g. Kabuga" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Village</label>
                    <input className="f-inp" name="village" value={form.village} onChange={h} placeholder="e.g. Gakombe" />
                  </div>
                </div>

                {/* Coordinates & Area */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>X Coordinate</label>
                    <input className="f-inp" name="x" type="number" value={form.x} onChange={h} placeholder="e.g. 470552.3679" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Y Coordinate</label>
                    <input className="f-inp" name="y" type="number" value={form.y} onChange={h} placeholder="e.g. 4716649.4" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Area (m²) *</label>
                    <input className="f-inp" name="area_m2" type="number" value={form.area_m2} onChange={h} placeholder="e.g. 4420.92" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Land Use *</label>
                    <input className="f-inp" name="land_use" value={form.land_use} onChange={h} placeholder="e.g. residential" />
                  </div>
                </div>

                {/* Zoning & Settlement */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Zoning</label>
                    <input className="f-inp" name="zoning" value={form.zoning} onChange={h} placeholder="e.g. R1B" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Zoning %</label>
                    <input className="f-inp" name="zoning_percentage" type="number" value={form.zoning_percentage} onChange={h} placeholder="e.g. 100" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Settlement</label>
                    <input className="f-inp" name="sentlement" value={form.sentlement} onChange={h} placeholder="e.g. Rural Settlement" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Settlement %</label>
                    <input className="f-inp" name="sentlement_percentage" type="number" value={form.sentlement_percentage} onChange={h} placeholder="e.g. 100" />
                  </div>
                </div>

                {/* Values */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Min Value/m²</label>
                    <input className="f-inp" name="minimum_value_per_sqm" type="number" value={form.minimum_value_per_sqm} onChange={h} placeholder="RWF" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Avg Value/m²</label>
                    <input className="f-inp" name="weighted_average_value_per_sqm" type="number" value={form.weighted_average_value_per_sqm} onChange={h} placeholder="RWF" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Max Value/m²</label>
                    <input className="f-inp" name="maximum_value_per_sqm" type="number" value={form.maximum_value_per_sqm} onChange={h} placeholder="RWF" />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:14, flexShrink:0 }}>
              <button className="btn-p" onClick={() => saveParcel(isEdit)} disabled={saving} style={{ flex:1, justifyContent:'center' }}>
                {saving ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> {isEdit ? 'Save Changes' : 'Register Parcel'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (<ConfirmDialog title="Delete Parcel" message={`Delete UPI: ${confirmDelete.upi}?`} detail={`Owner: ${confirmDelete.owner_name || 'Unassigned'}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />)}
      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.MapPin /> Land Parcels ({filtered.length})</span>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'white', 
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '20px',
              padding: '6px 12px'
              }}>
              <span style={{ color: '#0d9488', display: 'flex' }}><Ic.Search /></span>
              <input 
                placeholder="Search name or email..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ 
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 13,
                  fontFamily: '"Times New Roman",Times,serif',
                  color: '#0c1a19',
                  caretColor: '#0d9488',
                  width: '180px'
                }}/>
            </div>
            <button className="btn-p" onClick={() => { setShowAdd(true); setEditModal(null); setForm({...emptyForm}); setUpiAutoFilled(false); }} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)' }}>
              <Ic.Add /> Register UPI
            </button>
          </div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading parcels…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No parcels registered yet.<br /><button className="btn-p" style={{ marginTop:12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Register First UPI</button></div>}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead><tr><th>UPI</th><th>Owner</th><th>Province</th><th>District</th><th>Area (m²)</th><th>Land Use</th><th>Min/m²</th><th>Avg/m²</th><th>Max/m²</th><th>Transferred</th><th style={{ minWidth:120 }}>Actions</th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily:'monospace', fontWeight:700, color:'#0891b2', fontSize:12 }}>{p.upi}</td>
                    <td style={{ fontSize:13 }}>{p.owner_name || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>Unassigned</span>}</td>
                    <td style={{ fontSize:12 }}>{p.province || '—'}</td>
                    <td style={{ fontSize:12 }}>{p.district || '—'}</td>
                    <td style={{ fontSize:12 }}>{p.area_in_meter_square ? Number(p.area_in_meter_square).toLocaleString() : '—'}</td>
                    <td style={{ fontSize:12 }}>{p.land_use || '—'}</td>
                    <td style={{ fontSize:12, color:'#ef4444' }}>{p.minimum_value_per_sqm ? Number(p.minimum_value_per_sqm).toLocaleString() : '—'}</td>
                    <td style={{ fontSize:12, color:'#0891b2' }}>{p.weighted_average_value_per_sqm ? Number(p.weighted_average_value_per_sqm).toLocaleString() : '—'}</td>
                    <td style={{ fontSize:12, color:'#f59e0b' }}>{p.maximum_value_per_sqm ? Number(p.maximum_value_per_sqm).toLocaleString() : '—'}</td>
                    <td style={{ fontSize:12, color:'#0d9488' }}>{p.transferred_at ? fmtDate(p.transferred_at) : '—'}</td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <button className="tbl-btn tbl-edit" onClick={() => openEdit(p)}><Ic.Edit /> Edit</button>
                        <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(p)}><Ic.Trash /></button>
                      </div>
                    </td>
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

// ── Locations View ──
function ViewLocations({ addAlert }) {
  const [subTab, setSubTab] = useState('province');
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [cells, setCells] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name:'', province_id:'', district_id:'', sector_id:'', cell_id:'' });

  const TABS = [
    { id:'province', label:'Provinces' },
    { id:'district', label:'Districts' },
    { id:'sector',   label:'Sectors'   },
    { id:'cell',     label:'Cells'     },
    { id:'village',  label:'Villages'  },
  ];

  const load = useCallback(async (tab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === 'province') {
        const r = await fetch(`${API}/locations/provinces`);
        const d = await r.json();
        if (d.success) setProvinces(d.provinces || []);
      } else if (tab === 'district') {
        const r = await fetch(`${API}/locations/districts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        const d = await r.json();
        if (d.success) setDistricts(d.districts || []);
      } else if (tab === 'sector') {
        const r = await fetch(`${API}/locations/sectors`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        const d = await r.json();
        if (d.success) setSectors(d.sectors || []);
      } else if (tab === 'cell') {
        const r = await fetch(`${API}/locations/cells/by-sector`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        const d = await r.json();
        if (d.success) setCells(d.cells || []);
      } else if (tab === 'village') {
        const r = await fetch(`${API}/locations/villages/by-cell`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
        const d = await r.json();
        if (d.success) setVillages(d.villages || []);
      }
    } catch { addAlert('Cannot connect', 'error'); }
    if (!silent) setLoading(false);
  }, [addAlert]);

  // Also load parent data for dropdowns
  async function loadParents() {
    try {
      const [pr, dr, sr, cr] = await Promise.all([
        fetch(`${API}/locations/provinces`).then(r=>r.json()),
        fetch(`${API}/locations/districts`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()),
        fetch(`${API}/locations/sectors`,   {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()),
        fetch(`${API}/locations/cells`,     {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.json()),
      ]);
      if (pr.success) setProvinces(pr.provinces||[]);
      if (dr.success) setDistricts(dr.districts||[]);
      if (sr.success) setSectors(sr.sectors||[]);
      if (cr.success) setCells(cr.cells||[]);
    } catch {}
  }

  useEffect(() => { 
    load(subTab); 
  }, [subTab, load]);

  const [counts, setCounts] = useState({ province:0, district:0, sector:0, cell:0, village:0 });

  useEffect(() => {
    // Fast count-only fetch for tab badges
    fetch(`${API}/locations/counts`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCounts({
            province: d.counts.provinces,
            district: d.counts.districts,
            sector: d.counts.sectors,
            cell: d.counts.cells,
            village: d.counts.villages,
          });
        }
      }).catch(() => {});
  }, []);

  async function importAll() {
    if (!confirm('Import all provinces, districts, sectors, cells and villages from data.json? This may take a moment.')) return;
    setImporting(true);
    try {
      const user = JSON.parse(localStorage.getItem('lpe_user') || '{}');
    const r = await fetch(`${API}/admin/import-locations`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ admin_id: user.id }) });
      const d = await r.json();
      if (d.success) {
        addAlert(`✓ Imported: ${d.stats.provinces} provinces, ${d.stats.districts} districts, ${d.stats.sectors} sectors, ${d.stats.cells} cells, ${d.stats.villages} villages`, 'success');
        // Silent reload all tabs so counts update without spinner
        await Promise.all(['province','district','sector','cell','village'].map(tab => load(tab, true)));
      } else addAlert(d.message||'Import failed','error');
    } catch { addAlert('Cannot connect','error'); }
    setImporting(false);
  }

  function openAdd() {
    setEditItem(null);
    setForm({ name:'', province_id:'', district_id:'', sector_id:'', cell_id:'' });
    loadParents();
    setShowForm(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      name: item.name||'',
      province_id: item.province_id||'',
      district_id: item.district_id||'',
      sector_id:   item.sector_id||'',
      cell_id:     item.cell_id||'',
    });
    loadParents();
    setShowForm(true);
  }

  async function saveItem() {
    if (!form.name.trim()) { addAlert('Name is required','error'); return; }
    const base = `${API}/locations/${subTab}s`;
    const body = { name: form.name };
    if (subTab==='district') body.province_id = form.province_id;
    if (subTab==='sector')   body.district_id = form.district_id;
    if (subTab==='cell')     body.sector_id   = form.sector_id;
    if (subTab==='village')  body.cell_id     = form.cell_id;
    if (editItem) body.id = editItem.id;
    const url = editItem ? `${base}/update` : `${base}/create`;
    try {
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { addAlert(editItem ? 'Updated!':'Created!','success'); setShowForm(false); load(subTab); }
      else addAlert(d.message||'Failed','error');
    } catch { addAlert('Cannot connect','error'); }
  }

  async function doDelete(item) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/locations/${subTab}s/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: item.id }) });
      const d = await r.json();
      if (d.success) { addAlert('Deleted.','success'); load(subTab); }
      else addAlert(d.message||'Delete failed','error');
    } catch { addAlert('Delete failed','error'); }
  }

  const currentList = { province:provinces, district:districts, sector:sectors, cell:cells, village:villages }[subTab] || [];
  const currentLabel = { province:'Province', district:'District', sector:'Sector', cell:'Cell', village:'Village' }[subTab];

  const parentField = () => {
    if (subTab==='district') return (
      <div>
        <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Province *</label>
        <select className="f-inp" value={form.province_id} onChange={e => setForm(f=>({...f, province_id:e.target.value}))}>
          <option value="">— Select Province —</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
    );
    if (subTab==='sector') return (
      <div>
        <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>District *</label>
        <select className="f-inp" value={form.district_id} onChange={e => setForm(f=>({...f, district_id:e.target.value}))}>
          <option value="">— Select District —</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
    );
    if (subTab==='cell') return (
      <div>
        <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Sector *</label>
        <select className="f-inp" value={form.sector_id} onChange={e => setForm(f=>({...f, sector_id:e.target.value}))}>
          <option value="">— Select Sector —</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    );
    if (subTab==='village') return (
      <div>
        <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Cell *</label>
        <select className="f-inp" value={form.cell_id} onChange={e => setForm(f=>({...f, cell_id:e.target.value}))}>
          <option value="">— Select Cell —</option>
          {cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    );
    return null;
  };

  const parentCol = (item) => {
    if (subTab === 'district') return item.province_name || '—';
    if (subTab === 'sector')   return item.district_name || '—';
    if (subTab === 'cell')     return item.sector_name   || '—';
    if (subTab === 'village')  return item.cell_name     || '—';
    return null;
  };
  const parentLabel = { province:null, district:'Province', sector:'District', cell:'Sector', village:'Cell' }[subTab];

  return (
    <div className="view">
      {showForm && (
        <div className="m-overlay">
          <div className="m-box" style={{ maxWidth:420 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, fontFamily:'"Times New Roman",Times,serif' }}>{editItem ? `Edit ${currentLabel}` : `Add ${currentLabel}`}</div>
                <div style={{ fontSize:12, color:'#4d7c77', marginTop:2 }}>Location registry</div>
              </div>
              <button className="x-close-btn" onClick={() => setShowForm(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {parentField()}
              <div>
                <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>{currentLabel} Name *</label>
                <input className="f-inp" value={form.name} onChange={e => setForm(f=>({...f, name:e.target.value}))} placeholder={`e.g. ${currentLabel} name`} />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:6 }}>
                <button className="btn-p" onClick={saveItem} style={{ flex:1, justifyContent:'center' }}>
                  <Ic.Check /> {editItem ? 'Save Changes' : `Add ${currentLabel}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog title={`Delete ${currentLabel}`} message={`Delete "${confirmDelete.name}"?`} detail="This cannot be undone." confirmText="Yes, Delete" confirmColor="#ef4444"
          onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}

      <div className="info-banner" style={{ borderColor:'rgba(8,145,178,.2)', background:'rgba(8,145,178,.04)' }}>
        <span style={{ width:40, height:40, borderRadius:'50%', background:'rgba(8,145,178,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Ic.MapPin />
        </span>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>Location Registry</div>
          <div style={{ fontSize:12, color:'#4d7c77', lineHeight:1.6 }}>
            Manage Rwanda's administrative hierarchy: Province → District → Sector → Cell → Village.
            Use <strong>Import All</strong> to bulk-load from <code>data.json</code>, or add locations one by one.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.MapPin /> Locations</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-p" onClick={importAll} disabled={importing} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)' }}>
              {importing ? <><Ic.Spin /> Importing…</> : <><Ic.Refresh /> Import All from JSON</>}
            </button>
            <button className="btn-p" onClick={openAdd} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)' }}>
              <Ic.Add /> Add {currentLabel}
            </button>
          </div>
        </div>
        <div style={{ padding:'12px 20px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} className={`role-tab ${subTab===t.id?'active':''}`} onClick={() => setSubTab(t.id)}>
              {t.label}
              <span className="tab-count">
                {counts[t.id] ?? { province:provinces, district:districts, sector:sectors, cell:cells, village:villages }[t.id]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && currentList.length === 0 && (
          <div className="empty-state">No {currentLabel.toLowerCase()}s yet.<br />
            <button className="btn-p" style={{ marginTop:12 }} onClick={openAdd}><Ic.Add /> Add First {currentLabel}</button>
          </div>
        )}
        {!loading && currentList.length > 0 && (
          <div style={{ overflowX:'auto', margin:'14px 0 0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  {parentLabel && <th>{parentLabel}</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={{ fontSize:12, color:'#94a3b8' }}>{idx+1}</td>
                    <td style={{ fontWeight:700 }}>{item.name}</td>
                    {parentLabel && <td style={{ fontSize:12, color:'#4d7c77' }}>{parentCol(item)}</td>}
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="tbl-btn tbl-edit" onClick={() => openEdit(item)}><Ic.Edit /> Edit</button>
                        <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(item)}><Ic.Trash /></button>
                      </div>
                    </td>
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

// ── Transactions View (with Confirm/Reject/Edit/Delete, silent refresh) ──
function ViewTransactions({ addAlert, user }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [permissionModal, setPermissionModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const d = await r.json();
      if (d.success) setTxs(d.transactions || []);
    } catch { addAlert('Cannot connect', 'error'); }
    if (!silent) setLoading(false);
  }, [addAlert]);

  const filtered = txs.filter(t => filterStatus === 'all' ? true : t.status === filterStatus);

  // Grant permission to District to confirm mutation
  async function grantPermission(t) {
    if (!confirm(`Grant permission to District to confirm mutation ${t.reference}? This will allow the District Officer to finalize the transfer.`)) return;
    setPermissionModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/grant-permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction_id: t.id, 
          admin_id: user?.id,
          admin_notes: `Permission granted by Admin. District can now confirm the mutation.`
        })
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Permission granted for mutation ${t.reference}! District can now confirm.`, 'success');
        load(true);
        eventBus.emit('transactionChanged');
      } else addAlert(d.message || 'Failed to grant permission', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  // Confirm mutation (for private notary or after permission granted)
  async function confirmMutation(t) {
    setConfirmModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/confirm`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ transaction_id: t.id })
      });
      const d = await r.json();
      if (d.success) {
        await load(true);
        addAlert(`Mutation confirmed! Parcel transferred from ${t.seller_name} to ${t.buyer_name}`, 'success');
        eventBus.emit('transactionChanged');
      } else addAlert(d.message || 'Confirmation failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  async function rejectMutation(t) {
    if (!rejectReason.trim()) {
      addAlert('Please provide a reason for rejection', 'error');
      return;
    }
    setRejectModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/reject`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ transaction_id: t.id, reason: rejectReason })
      });
      const d = await r.json();
      if (d.success) {
        await load(true);
        addAlert(`Mutation rejected: ${rejectReason.substring(0, 100)}`, 'warning');
        eventBus.emit('transactionChanged');
      } else addAlert(d.message || 'Rejection failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setRejectReason('');
  }

  async function editMutation(t, updatedData) {
    setEditModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/edit`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          transaction_id: t.id,
          buyer_name: updatedData.buyer_name,
          seller_name: updatedData.seller_name,
          agreed_price: updatedData.agreed_price,
          upi: updatedData.upi,
          notary_name: updatedData.notary_name
        })
      });
      const d = await r.json();
      if (d.success) {
        await load(true);
        addAlert(`Mutation ${t.reference} updated successfully!`, 'success');
        eventBus.emit('transactionChanged');
      } else addAlert(d.message || 'Edit failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  async function deleteMutation(t) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/transactions/delete`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ transaction_id: t.id })
      });
      const d = await r.json();
      if (d.success) {
        await load(true);
        addAlert(`Mutation ${t.reference} deleted.`, 'success');
        eventBus.emit('transactionChanged');
      } else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  useEffect(() => {
    load(false);
    
    const interval = setInterval(() => {
      fetch(`${API}/transactions/all`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: '{}' 
      })
        .then(r => r.json())
        .then(d => { 
          if (d.success) {
            setTxs(prev => {
              const newData = d.transactions || [];
              if (JSON.stringify(prev) !== JSON.stringify(newData)) {
                return newData;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 30000);
    
    const unsub = eventBus.on('transactionChanged', () => load(true));
    
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [load]);

  const statusColor = s => ({ 
    approved: '#0d9488', 
    pending: '#f59e0b', 
    rejected: '#ef4444',
    forwarded_to_admin: '#7c3aed',
    permission_granted: '#10b981'
  }[s] || '#94a3b8');

  const statusLabel = s => ({
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    forwarded_to_admin: 'Awaiting Permission',
    permission_granted: 'Permission Granted'
  }[s] || s);

  const pendingCount = txs.filter(t => t.status === 'pending' || t.status === 'forwarded_to_admin').length;

  return (
    <div className="view">
      {/* Confirm Modal */}
      {confirmModal && (
        <div className="m-overlay" onClick={() => setConfirmModal(null)}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(13,148,136,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Confirm Mutation</div>
                  <div style={{ fontSize: 12, color: '#4d7c77' }}>Transfer ownership from seller to buyer</div>
                </div>
              </div>
              <button onClick={() => setConfirmModal(null)} className="x-close-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ background: '#f0fdfa', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div><strong>UPI:</strong> {confirmModal.upi}</div>
              <div><strong>Seller:</strong> {confirmModal.seller_name}</div>
              <div><strong>Buyer:</strong> {confirmModal.buyer_name}</div>
              <div><strong>Price:</strong> {Number(confirmModal.agreed_price || 0).toLocaleString()} RWF</div>
              <div><strong>Notary:</strong> {confirmModal.notary_name || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => confirmMutation(confirmModal)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Confirm & Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="m-overlay" onClick={() => setRejectModal(null)}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Reject Mutation</div>
                  <div style={{ fontSize: 12, color: '#4d7c77' }}>Provide reason for rejection</div>
                </div>
              </div>
              <button onClick={() => setRejectModal(null)} className="x-close-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div><strong>UPI:</strong> {rejectModal.upi}</div>
              <div><strong>Seller:</strong> {rejectModal.seller_name} → <strong>Buyer:</strong> {rejectModal.buyer_name}</div>
            </div>
            <textarea
              className="f-inp"
              rows={3}
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => rejectMutation(rejectModal)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Reject Mutation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditTransactionModal
          transaction={editModal}
          onConfirm={editMutation}
          onCancel={() => setEditModal(null)}
          addAlert={addAlert}
        />
      )}

      {/* Delete Confirm Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Mutation"
          message={`Delete mutation ${confirmDelete.reference}?`}
          detail={`Buyer: ${confirmDelete.buyer_name} ↔ Seller: ${confirmDelete.seller_name}`}
          confirmText="Yes, Delete"
          confirmColor="#ef4444"
          onConfirm={() => deleteMutation(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Documents Modal */}
      {docsModal && (
        <div className="m-overlay" onClick={() => { setDocsModal(null); setDocsData(null); }}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Mutation Documents</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Ref: {docsModal.reference} · UPI: {docsModal.upi}</div>
              </div>
              <button className="x-close-btn" onClick={() => { setDocsModal(null); setDocsData(null); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {docsLoading && <div style={{ padding: 30, textAlign: 'center', color: '#4d7c77' }}><Ic.Spin /> Loading documents…</div>}
            {!docsLoading && docsData && (
  <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
    <style>{`.docs-scroll::-webkit-scrollbar{display:none}`}</style>
    <div className="docs-scroll">

      {/* Notary Info card */}
      {docsData.notary_info && typeof docsData.notary_info === 'object' && (
        <div style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Notary Information</div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{docsData.notary_info.notary_name || '—'}</div>
          <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {docsData.notary_info.notary_type && <span>Type: <strong>{docsData.notary_info.notary_type}</strong></span>}
            {docsData.notary_info.sector_name && <span>Sector: <strong>{docsData.notary_info.sector_name}</strong></span>}
            {docsData.notary_info.district_name && <span>District: <strong>{docsData.notary_info.district_name}</strong></span>}
            {docsData.notary_info.license_number && <span>License: <strong>{docsData.notary_info.license_number}</strong></span>}
          </div>
        </div>
      )}

      {/* Other scalar fields */}
      {(() => {
        const skip = new Set(['success', 'message', 'documents', 'files', 'attachments', 'notary_info']);
        const fields = Object.entries(docsData).filter(([k, v]) => !skip.has(k) && typeof v !== 'object');
        return fields.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 16 }}>
            {fields.map(([k, v]) => (
              <div key={k} style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{String(v ?? '—')}</div>
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {/* Documents list */}
      {(() => {
        const docs = docsData.documents || docsData.files || docsData.attachments || [];
        if (docs.length === 0) return (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No documents found for this mutation.
          </div>
        );
        const docLabels = {
          signed_agreement: 'Notarized Document', stamped_agreement: 'Stamped Agreement',
          official_form: 'Official Form', support_doc_1: 'Supporting Doc 1', support_doc_2: 'Supporting Doc 2',
          seller_id_document: 'Seller National ID', spouse_id_document: 'Spouse National ID',
          buyer_id_document: 'Buyer National ID', land_title: 'Land Title', seller_id: 'Seller ID',
          spouse_id: 'Spouse ID', buyer_id: 'Buyer ID',
          civil_cert_seller: 'Civil Certificate (Seller)', civil_cert_buyer: 'Civil Certificate (Buyer)',
        };
        return (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
              Attached Documents ({docs.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map((doc, i) => {
                const filePath = doc.file_path || doc.url || doc.path || '';
                const label = docLabels[doc.doc_type] || (doc.doc_type || '').replace(/_/g, ' ');
                const displayName = doc.original_name || filePath || `Document ${i + 1}`;
                const isNotary = doc.source === 'notary';
                const viewUrl = filePath ? `https://land-price-api-35fr.onrender.com/uploads/${filePath}` : '';
                return (
                  <div key={i} style={{ background: isNotary ? '#f0fdfa' : '#eff6ff', border: `1px solid ${isNotary ? '#ccf2ee' : '#bfdbfe'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: isNotary ? '#0d9488' : '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#4d7c77', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                      <div style={{ fontSize: 10, marginTop: 2 }}>
                        <span style={{ padding: '2px 7px', borderRadius: 20, background: isNotary ? 'rgba(13,148,136,.1)' : 'rgba(8,145,178,.1)', color: isNotary ? '#0d9488' : '#0891b2', fontWeight: 700 }}>{isNotary ? 'Notary' : 'Buyer'}</span>
                        {doc.verified && <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 20, background: 'rgba(22,163,74,.1)', color: '#16a34a', fontWeight: 700 }}>✓ Verified</span>}
                      </div>
                    </div>
                    {viewUrl && (
                      <a href={viewUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: 'rgba(13,148,136,.1)', color: '#0d9488', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        View
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.Monitor /> All Mutations ({txs.length})
            {pendingCount > 0 && (
              <span style={{ background: '#f59e0b', borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
                {pendingCount} pending
              </span>
            )}
          </span>
        </div>

        {/* STATUS FILTER BUTTONS */}
        <div style={{ display: 'flex', gap: 6, margin: '12px 20px', padding: '0', flexWrap: 'wrap', borderBottom: '1px solid #ccf2ee', paddingBottom: '12px' }}>
          {['all', 'pending', 'forwarded_to_admin', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ 
                padding: '6px 14px', 
                borderRadius: 40, 
                border: 'none', 
                background: filterStatus === s ? '#0d9488' : '#f0fdfa',
                color: filterStatus === s ? 'white' : '#4d7c77',
                fontSize: 12, 
                fontWeight: 700, 
                cursor: 'pointer',
                transition: 'all .15s'
              }}>
              {s === 'forwarded_to_admin' ? 'Admin Review' : s === 'all' ? 'All' : s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Rejected'}
            </button>
          ))}
        </div>

        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No mutations in {filterStatus === 'all' ? '' : filterStatus} status.</div>}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th><th>UPI</th><th>Buyer</th><th>Seller</th>
                  <th>Notary</th><th>Price (RWF)</th><th>Status</th><th>Date</th>
                  <th style={{minWidth:'200px',whiteSpace:'nowrap'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 12 }}>{t.reference}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.upi}</td>
                    <td>{t.buyer_name}</td>
                    <td>{t.seller_name}</td>
                    <td style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                      {t.notary_name || '—'}
                    </td>
                    <td style={{ fontWeight: 700 }}>{Number(t.agreed_price || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(t.status) }}>
                        ● {statusLabel(t.status)}
                        {t.status === 'rejected' && t.rejection_reason && (
                          <span style={{ fontSize: 10, display: 'block', color: '#ef4444' }}>{t.rejection_reason.substring(0, 30)}</span>
                        )}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(t.created_at)}</td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <div style={{ display: 'flex', gap: 4, flexWrap:'nowrap', alignItems:'center' }}>
                        
                        {/* Private Notary mutations - Admin confirms directly */}
                        {t.status === 'pending' && t.notary_type === 'private' && (
                          <>
                            <button className="tbl-btn" style={{ background: 'rgba(16,185,129,.1)', color: '#10b981' }} onClick={() => setConfirmModal(t)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                              Confirm
                            </button>
                            <button className="tbl-btn tbl-del" onClick={() => setRejectModal(t)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                              Reject
                            </button>
                          </>
                        )}

                        {/* District mutations - Admin grants permission */}
                        {t.status === 'forwarded_to_admin' && (
                          <button className="tbl-btn" style={{ background: 'rgba(13,148,136,.1)', color: '#0d9488' }} onClick={() => grantPermission(t)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 L12 6 M12 18 L12 22 M4.93 4.93 L7.76 7.76 M16.24 16.24 L19.07 19.07 M2 12 L6 12 M18 12 L22 12 M4.93 19.07 L7.76 16.24 M16.24 7.76 L19.07 4.93" stroke="currentColor"/><path d="M12 8 L12 12 L15 15" stroke="currentColor"/></svg>
                            Grant Permission
                          </button>
                        )}

                        {/* Rejected can be re-confirmed */}
                        {t.status === 'rejected' && (
                          <button className="tbl-btn" style={{ background: 'rgba(16,185,129,.1)', color: '#10b981' }} onClick={() => setConfirmModal(t)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            Re-Confirm
                          </button>
                        )}

                        {/* Approved - show transferred status */}
                        {t.status === 'approved' && (
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ Transferred</span>
                        )}

                        {/* Docs button always visible */}
                        <button className="tbl-btn" style={{ background: 'rgba(8,145,178,.08)', color: '#0891b2' }} onClick={async () => {
                          setDocsModal(t);
                          setDocsLoading(true);
                          setDocsData(null);
                          try {
                            const r = await fetch(`${API}/transaction/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: t.id, reference: t.reference }) });
                            const d = await r.json();
                            if (d.success) setDocsData(d);
                          } catch { }
                          setDocsLoading(false);
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          Docs
                        </button>
                        <button className="tbl-btn tbl-edit" onClick={() => setEditModal(t)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit
                        </button>
                        <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(t)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          Delete
                        </button>
                      </div>
                    </td>
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
// ── Edit Transaction Modal ──
function EditTransactionModal({ transaction, onConfirm, onCancel, addAlert }) {
  const [form, setForm] = useState({
    upi: transaction.upi || '',
    buyer_name: transaction.buyer_name || '',
    seller_name: transaction.seller_name || '',
    agreed_price: transaction.agreed_price || '',
    notary_name: transaction.notary_name || '',
  });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.buyer_name.trim()) { addAlert('Buyer name is required', 'error'); return; }
    if (!form.seller_name.trim()) { addAlert('Seller name is required', 'error'); return; }
    if (!form.agreed_price || isNaN(form.agreed_price)) { addAlert('Valid agreed price is required', 'error'); return; }
    setLoading(true);
    await onConfirm(transaction, form);
    setLoading(false);
  }

  return (
    <div className="m-overlay">
      <div className="m-box" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Edit Mutation</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Reference: {transaction.reference}</div>
          </div>
          <button onClick={onCancel} className="x-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>UPI</label>
            <input className="f-inp" value={form.upi} onChange={e => setForm(f => ({ ...f, upi: e.target.value }))} placeholder="xx/xx/xx/xx/xxxx" />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Buyer Name *</label>
            <input className="f-inp" value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} placeholder="Buyer full name" />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Seller Name *</label>
            <input className="f-inp" value={form.seller_name} onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))} placeholder="Seller full name" />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Agreed Price (RWF) *</label>
            <input className="f-inp" type="number" value={form.agreed_price} onChange={e => setForm(f => ({ ...f, agreed_price: e.target.value }))} placeholder="e.g. 15000000" />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Notary Name</label>
            <input className="f-inp" value={form.notary_name} onChange={e => setForm(f => ({ ...f, notary_name: e.target.value }))} placeholder="Notary who processed this" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn-p" onClick={submit} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Land & Predict View ──
function ViewPredict({ addAlert }) {
  const [upi, setUpi] = useState('');
  const [landData, setLandData] = useState(null);
  const [searching, setSearching] = useState(false);
  const [predLoad, setPredLoad] = useState(false);
  const [preds, setPreds] = useState(null);
  const [predErr, setPredErr] = useState('');
  const [showPreds, setShowPreds] = useState(false);

  async function estimatePrice(upiValue) {
    setPredLoad(true); setPreds(null); setPredErr('');
    try {
      const r = await fetch(`${API}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upiValue }) });
      const d = await r.json();
      if (d.success) setPreds(d); else setPredErr(d.message || 'Prediction failed');
    } catch { setPredErr('Cannot connect.'); }
    setPredLoad(false);
  }

  async function handleSearch(e) {
    e.preventDefault(); setLandData(null); setShowPreds(false); setPreds(null); setPredErr(''); setSearching(true);
    try {
      const r = await fetch(`${API}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upi.trim() }) });
      const d = await r.json();
      if (d.success) { setLandData(d.data); await estimatePrice(d.data.UPI); }
      else addAlert(d.message || 'UPI not found.', 'error');
    } catch { addAlert('Cannot connect.', 'error'); }
    setSearching(false);
  }

  function calcTax(price) {
    if (price <= 5000000) return <span className="no-tax">✓ No Tax (below 5M RWF)</span>;
    const tax = (price - 5000000) * 0.025;
    return <span>Tax: <strong>{Math.round(tax).toLocaleString('en-US')} RWF</strong> (2.5%)</span>;
  }

  function PriceCard({ type, label, price, perSqm, taxNode }) {
    const fmtPrice = Math.round(price).toLocaleString('en-US') + ' RWF';
    const fmtPerSqm = parseFloat(perSqm).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' RWF/m²';
    const colors = {
      minimum: { top:'#ef4444', bg:'#f0fdf4', border:'#86efac', accent:'#16a34a' },
      average: { top:'#0891b2', bg:'#eff6ff', border:'#93c5fd', accent:'#2563eb' },
      maximum: { top:'#f59e0b', bg:'#fef3c7', border:'#fcd34d', accent:'#d97706' },
    };
    const c = colors[type] || colors.average;
    return (
      <div style={{ background:c.bg, border:`2px solid ${c.border}`, borderRadius:16, overflow:'hidden', width:'100%', display:'flex', flexDirection:'column' }}>
        <div style={{ height:6, background:c.top, width:'100%' }} />
        <div style={{ padding:'20px 24px', textAlign:'center', flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, color:c.accent, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>{label}</div>
          <div style={{ fontSize:22, fontWeight:800, color:c.accent, marginBottom:4, lineHeight:1.2 }}>{fmtPrice}</div>
          <div style={{ fontSize:12, color:'#4d7c77', marginBottom:16, fontFamily:'monospace' }}>{fmtPerSqm}</div>
          <div style={{ width:'100%', background:'rgba(255,255,255,0.7)', border:`1px solid ${c.border}`, borderRadius:10, padding:'10px 14px', fontSize:12, color:'#374151', marginTop:'auto' }}>{taxNode}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Search /> Search Land Data by UPI</div>
        <div style={{ padding:'18px 20px' }}>
          <form onSubmit={handleSearch} style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1, position:'relative' }}>
              <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'#4d7c77', display:'flex' }}><Ic.Search /></span>
              <input className="f-inp" style={{ paddingLeft:38 }} placeholder="e.g. xx/xx/xx/xx/xxxx" value={upi} onChange={e => setUpi(e.target.value)} required />
            </div>
            <button className="btn-p" type="submit" disabled={searching || predLoad}>
              {(searching || predLoad) ? <><Ic.Spin /> Searching…</> : <><Ic.Search /> Search & Estimate</>}
            </button>
          </form>
        </div>
        {landData && (
          <div style={{ padding:'0 20px 20px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', marginBottom:12 }}>Parcel: {landData.UPI}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
              {Object.entries(landData).filter(([k]) => k !== '_source').map(([k,v]) => (
                <div key={k} style={{ background:'#f0fdfa', border:'1px solid #ccf2ee', borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>{k.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{String(v) || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {predLoad && <div style={{ padding:'24px', textAlign:'center', color:'#4d7c77' }}><Ic.Spin /> &nbsp;Running AI estimation model…</div>}
        {predErr && <div className="alert-e" style={{ margin:'0 20px 20px' }}>{predErr}</div>}
        {preds && !predLoad && (
          <div style={{ padding:'0 0 24px', width:'100%' }}>
            <button className="btn-p" style={{ margin:'0 0 18px', justifyContent:'center', width:'100%' }} onClick={() => setShowPreds(v => !v)}>
              <Ic.Predict /> {showPreds ? 'Hide AI Price Estimation' : 'View AI Price Estimation'}
            </button>
            {showPreds && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, padding:'0 20px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#4d7c77', textTransform:'uppercase' }}>AI Price Estimation</div>
                  <div style={{ flex:1, height:1, background:'#ccf2ee' }} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, width:'100%' }}>
                  <PriceCard type="minimum" label="Minimum" price={preds.min_price} perSqm={preds.min_per_sqm} taxNode={calcTax(preds.min_price)} />
                  <PriceCard type="average"  label="Average"  price={preds.avg_price} perSqm={preds.avg_per_sqm} taxNode={calcTax(preds.avg_price)} />
                  <PriceCard type="maximum" label="Maximum" price={preds.max_price} perSqm={preds.max_per_sqm} taxNode={calcTax(preds.max_price)} />
                </div>
                <div style={{ margin:'14px 20px 0', padding:'10px 14px', background:'#f0fdfa', border:'1px solid #ccf2ee', borderRadius:10, fontSize:12, color:'#4d7c77', display:'flex', alignItems:'center', justifyContent:'center', gap:8, textAlign:'center' }}>
                  <Ic.Info /> A 2.5% Capital Gains Tax applies only to the portion of the price above 5,000,000 RWF
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

  function ViewSuggestions({ addAlert }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/suggestions/all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      .then(r => r.json()).then(d => { if (d.success) setSuggestions(d.suggestions || []); })
      .catch(() => addAlert('Cannot connect','error')).finally(() => setLoading(false));
  }, [addAlert]);

  async function deleteSuggestion(id) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/suggestions/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suggestion_id: id }) });
      const d = await r.json();
      if (d.success) { load(); addAlert('Suggestion deleted.','success'); }
      else addAlert(d.message || 'Delete failed','error');
    } catch { addAlert('Delete failed','error'); }
  }

  async function deleteAllSuggestions() {
    setConfirmDeleteAll(false);
    try {
      const r = await fetch(`${API}/admin/suggestions/delete-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
      const d = await r.json();
      if (d.success) { load(); addAlert('All suggestions deleted.','success'); }
      else addAlert(d.message || 'Delete failed','error');
    } catch { addAlert('Delete failed','error'); }
  }

  useEffect(() => { load(); const unsub = eventBus.on('suggestionAdded', () => load()); return () => unsub(); }, [load]);

  const CATS = { general:'#6366f1', feature:'#0d9488', bug:'#ef4444', transaction:'#f59e0b', pricing:'#ec4899' };
  const catLabel = c => ({ general:'General', feature:'Feature', bug:'Bug', transaction:'Transaction', pricing:'Pricing' }[c] || c);
  const ratingStars = n => <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i<=n?'#f59e0b':'#d1d5db', fontSize:14 }}>★</span>)}</span>;

  return (
    <div className="view">
      {confirmDelete && <ConfirmDialog title="Delete Suggestion" message="Delete this suggestion?" detail={confirmDelete.message?.substring(0,100) + (confirmDelete.message?.length>100?'...':'')} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => deleteSuggestion(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteAll && <ConfirmDialog title="Delete All Suggestions" message={`Delete ALL ${suggestions.length} suggestions?`} detail="This action cannot be undone." confirmText="Yes, Delete All" confirmColor="#ef4444" onConfirm={deleteAllSuggestions} onCancel={() => setConfirmDeleteAll(false)} />}
      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.Suggestions /> User Suggestions ({suggestions.length})</span>
          {suggestions.length > 0 && <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)}><Ic.Trash /> Delete All</button>}
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && suggestions.length === 0 && <div className="empty-state">No suggestions yet.</div>}
      </div>
      {!loading && suggestions.map(s => {
        const color = CATS[s.category] || '#6366f1';
        return (
          <div key={s.id} className="sug-card">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10, gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1 }}>
                <span className="role-chip" style={{ background:`${color}18`, color, border:`1px solid ${color}30`, fontSize:11 }}>{catLabel(s.category)}</span>
                {s.rating > 0 && ratingStars(s.rating)}
                <span style={{ fontSize:11, color:'#4d7c77' }}>{s.user_name || 'Anonymous'}</span>
                <span style={{ fontSize:11, color:'#94a3b8' }}>·</span>
                <span style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(s.created_at)}</span>
              </div>
              <button onClick={() => setConfirmDelete(s)} className="tbl-btn tbl-del" style={{ flexShrink:0, padding:'5px 10px' }}><Ic.Trash /></button>
            </div>
            <div style={{ fontSize:13, lineHeight:1.7, color:'#1e293b', background:'#f8fafc', borderRadius:8, padding:'10px 14px', borderLeft:`3px solid ${color}` }}>{s.message}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Reports & Inbox ──
function ViewReportsAndInbox({ addAlert }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [genType, setGenType] = useState('summary');
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/inbox`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
      const d = await r.json();
      if (d.success) setReports(d.reports || []);
    } catch { addAlert('Cannot connect','error'); }
    setLoading(false);
  }, [addAlert]);

  async function deleteReport(reportId) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/reports/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ report_id: reportId }) });
      const d = await r.json();
      if (d.success) { loadInbox(); addAlert('Report deleted.','success'); }
      else addAlert(d.message || 'Delete failed','error');
    } catch { addAlert('Delete failed','error'); }
  }

  async function deleteAllReports() {
    setConfirmDeleteAll(false);
    try {
      const r = await fetch(`${API}/admin/reports/delete-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
      const d = await r.json();
      if (d.success) { loadInbox(); addAlert('All reports deleted.','success'); }
      else addAlert(d.message || 'Delete failed','error');
    } catch { addAlert('Delete failed','error'); }
  }

  async function generateReport(e) {
    e.preventDefault(); setGenResult(null); setGenLoading(true);
    try {
      const r = await fetch(`${API}/admin/report`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ report_type: genType }) });
      const d = await r.json();
      if (d.success) { setGenResult(d); addAlert(`Report generated: ${d.reference}`,'success'); eventBus.emit('reportGenerated'); }
      else addAlert(d.message || 'Generation failed','error');
    } catch { addAlert('Cannot connect','error'); }
    setGenLoading(false);
  }

  function downloadReport(report) {
    const blob = new Blob([`REPORT: ${report.reference}\nFrom: ${report.from_name}\nType: ${report.type}\nSent: ${fmtDate(report.sent_at)}\n\n${report.content || '(No content)'}`], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${report.reference}.txt`; a.click(); URL.revokeObjectURL(url);
    addAlert(`Downloaded ${report.reference}`,'success');
  }

  useEffect(() => {
    loadInbox();
    const unsub = eventBus.on('reportGenerated', () => loadInbox());
    return () => unsub();
  }, [loadInbox]);

  const unread = reports.filter(r => !r.read).length;
  const roleColor = role => ({ district_land_officer:'#0891b2', sector_land_officer:'#22c55e', notary:'#8b5cf6', admin:'#0d9488' }[role] || '#64748b');
  const typeLabels = { summary:'Summary', parcels:'Parcels', officers:'Officers', pending:'Pending', mutations:'Mutations', approved:'Approved', rejected:'Rejected' };

  return (
    <div className="view">
      {confirmDelete && <ConfirmDialog title="Delete Report" message={`Delete report ${confirmDelete.reference}?`} detail={`From: ${confirmDelete.from_name}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => deleteReport(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteAll && <ConfirmDialog title="Delete All Reports" message={`Delete ALL ${reports.length} reports?`} detail="This action cannot be undone." confirmText="Yes, Delete All" confirmColor="#ef4444" onConfirm={deleteAllReports} onCancel={() => setConfirmDeleteAll(false)} />}
      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Ic.Report /> Reports Inbox
            {unread > 0 && <span style={{ background:'rgba(255,255,255,.25)', borderRadius:50, padding:'2px 10px', fontSize:11, fontWeight:800 }}>{unread} new</span>}
          </span>
          {reports.length > 0 && <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)}><Ic.Trash /> Delete All</button>}
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading inbox…</div>}
        {!loading && reports.length === 0 && <div className="empty-state">Inbox is empty.</div>}
      </div>
      {!loading && reports.map(rpt => {
        const isExpanded = expanded === rpt.id;
        const rColor = roleColor(rpt.from_role);
        return (
          <div key={rpt.id} className="report-card">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, color:'#0d9488', fontSize:13 }}>{rpt.reference}</span>
                  {!rpt.read && <span style={{ background:'#0d9488', color:'white', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20 }}>NEW</span>}
                  <span style={{ background:`${rColor}18`, color:rColor, border:`1px solid ${rColor}30`, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20 }}>{typeLabels[rpt.type] || rpt.type}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:`linear-gradient(135deg,${rColor},${rColor}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>{rpt.from_name?.[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{rpt.from_name}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{fmtDate(rpt.sent_at)}</div>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => setExpanded(isExpanded ? null : rpt.id)} className="tbl-btn" style={{ background: isExpanded?'rgba(13,148,136,.15)':'rgba(13,148,136,.08)', color:'#0d9488', padding:'6px 12px', gap:5 }}>
                  {isExpanded ? <><Ic.EyeOff /> Close</> : <><Ic.Eye /> View Report</>}
                </button>
                <button onClick={() => downloadReport(rpt)} className="tbl-btn" style={{ background:'rgba(59,130,246,.08)', color:'#2563eb', padding:'6px 10px' }} title="Download">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
                <button onClick={() => setConfirmDelete(rpt)} className="tbl-btn tbl-del" style={{ padding:'6px 10px' }}><Ic.Trash /></button>
              </div>
            </div>
            {isExpanded && (
              <div style={{ marginTop:4, animation:'fadeUp .2s ease' }}>
                <div style={{ background:'#f9fefd', border:'1px solid #ccf2ee', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>Report Content</div>
                  <pre style={{ fontFamily:'monospace', fontSize:12, whiteSpace:'pre-wrap', lineHeight:1.7, color:'#1e293b', margin:0 }}>{rpt.content || '(No content)'}</pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Settings View ──
function ViewSettings({ addAlert }) {
  const [settings, setSettings] = useState({ system_name:'Land Price Estimation System', tax_free_threshold:'5000000', tax_rate:'2.5', allow_self_registration:true, require_notary_approval:true, require_sector_verification:true, max_price_rw:'1000000000', default_currency:'RWF', maintenance_mode:false, email_notifications:true });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveSettings() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/settings`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) });
      const d = await r.json();
      if (d.success) { addAlert('Settings saved!','success'); setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else addAlert(d.message || 'Save failed','error');
    } catch { addAlert('Settings saved locally (server offline).','success'); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setLoading(false);
  }

  const h = e => setSettings(s => ({ ...s, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="view">
      <div className="info-banner">
        <span style={{ width:36, height:36, borderRadius:'50%', background:'rgba(13,148,136,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </span>
        <div>
          <div style={{ fontWeight:700, fontSize:13 }}>System Settings</div>
          <div style={{ fontSize:12, color:'#4d7c77', lineHeight:1.6 }}>These settings control the behavior of the entire LPES platform. Changes take effect immediately after saving.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd" style={{ background:'linear-gradient(135deg,#0d9488,#0d9488bb)' }}>General Configuration</div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
            {[['system_name','System Name','text'],['default_currency','Default Currency','text'],['tax_free_threshold','Tax-Free Threshold (RWF)','number'],['tax_rate','Capital Gains Tax Rate (%)','number'],['max_price_rw','Max Allowed Price (RWF)','number']].map(([name,label,type]) => (
              <div key={name}>
                <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:6 }}>{label}</label>
                <input className="f-inp" type={type} name={name} value={settings[name]} onChange={h} step={name==='tax_rate'?'0.1':undefined} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd" style={{ background:'linear-gradient(135deg,#8b5cf6,#8b5cf6bb)' }}>System Toggles</div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { name:'allow_self_registration',     label:'Allow Public Self-Registration',  desc:'Buyers/Sellers can register themselves',      danger:false },
              { name:'require_notary_approval',     label:'Require Notary Approval',          desc:'Mutations must be certified by a notary',     danger:false },
              { name:'require_sector_verification', label:'Require Sector Verification',      desc:'Parcels must be verified by sector officer',  danger:false },
              { name:'email_notifications',         label:'Email Notifications',              desc:'Send email alerts for important events',       danger:false },
              { name:'maintenance_mode',            label:'Maintenance Mode',                 desc:'Lock system for non-admin users',              danger:true  },
            ].map(t => (
              <div key={t.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:t.danger&&settings[t.name]?'#fff1f2':'#f9fefd', border:`1px solid ${t.danger&&settings[t.name]?'#fecaca':'#ccf2ee'}`, borderRadius:12, transition:'all .2s' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:t.danger&&settings[t.name]?'#ef4444':'#0c1a19' }}>{t.label}</div>
                  <div style={{ fontSize:11, color:'#4d7c77', marginTop:2 }}>{t.desc}</div>
                </div>
                <label style={{ position:'relative', display:'inline-block', width:44, height:24, flexShrink:0, marginLeft:16 }}>
                  <input type="checkbox" name={t.name} checked={settings[t.name]} onChange={h} style={{ opacity:0, width:0, height:0 }} />
                  <span style={{ position:'absolute', cursor:'pointer', top:0, left:0, right:0, bottom:0, background:settings[t.name]?(t.danger?'#ef4444':'#0d9488'):'#94a3b8', borderRadius:24, transition:'.3s' }}>
                    <span style={{ position:'absolute', height:18, width:18, left:settings[t.name]?23:3, bottom:3, background:'white', borderRadius:'50%', transition:'.3s' }} />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className="btn-p" onClick={saveSettings} disabled={loading} style={{ minWidth:180, justifyContent:'center', background:saved?'linear-gradient(135deg,#10b981,#059669)':undefined }}>
          {loading ? <><Ic.Spin /> Saving…</> : saved ? <><Ic.Check /> Saved!</> : <><Ic.Save /> Save Settings</>}
        </button>
      </div>
    </div>
  );
}

function ViewPriceTrends({ addAlert }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('year'); // 'year' | 'month'
  const [metric, setMetric] = useState('avg');    // 'min' | 'avg' | 'max'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/stamped-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const d = await r.json();
      if (d.success) setRecords(d.records || []);
      else addAlert(d.message || 'Failed to load records', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [addAlert]);

  useEffect(() => { load(); }, [load]);

  // ── Group records by year or month ──
  const grouped = useMemo(() => {
    const map = {};
    records.forEach(rec => {
      const date = rec.stamped_at || rec.signed_date;
      if (!date) return;
      const d = new Date(date);
      if (isNaN(d)) return;
      const key = groupBy === 'year'
        ? String(d.getFullYear())
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!map[key]) map[key] = { agreed: [], ml_avg: [], ml_min: [], ml_max: [], count: 0 };
      if (rec.agreed_price)  map[key].agreed.push(Number(rec.agreed_price));
      if (rec.ml_avg_price)  map[key].ml_avg.push(Number(rec.ml_avg_price));
      if (rec.ml_min_price)  map[key].ml_min.push(Number(rec.ml_min_price));
      if (rec.ml_max_price)  map[key].ml_max.push(Number(rec.ml_max_price));
      map[key].count++;
    });

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const min = arr => arr.length ? Math.round(Math.min(...arr)) : null;
    const max = arr => arr.length ? Math.round(Math.max(...arr)) : null;
    
    // Get the ML value based on selected metric
    const getMlValue = (v, metricType) => {
      if (metricType === 'min') return min(v.ml_min);
      if (metricType === 'max') return max(v.ml_max);
      return avg(v.ml_avg);
    };

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, v]) => {
        const agreedVal = avg(v.agreed);
        const mlVal = getMlValue(v, metric);
        return {
          period,
          agreed: agreedVal,
          ml: mlVal,
          ml_min: min(v.ml_min),
          ml_avg: avg(v.ml_avg),
          ml_max: max(v.ml_max),
          count: v.count,
          diff: (agreedVal != null && mlVal != null) ? agreedVal - mlVal : null,
          pct: (agreedVal != null && mlVal != null && mlVal !== 0)
            ? (((agreedVal - mlVal) / mlVal) * 100).toFixed(1)
            : null,
        };
      });
  }, [records, groupBy, metric]);

  // ── Chart dimensions ──
  const chartW = 820, chartH = 320, padL = 80, padR = 24, padT = 24, padB = 60;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const allVals = grouped.flatMap(g => [g.agreed, g.ml].filter(Boolean));
  const yMin = allVals.length ? Math.min(...allVals) * 0.85 : 0;
  const yMax = allVals.length ? Math.max(...allVals) * 1.1  : 1;

  const xScale = i => padL + (grouped.length > 1 ? (i / (grouped.length - 1)) * innerW : innerW / 2);
  const yScale = v => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const fmt = v => v != null ? (v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : (v / 1_000).toFixed(0) + 'K') : '—';
  const fmtFull = v => v != null ? Number(v).toLocaleString() + ' RWF' : '—';

  // polyline points
  const agreedPts = grouped.map((g, i) => g.agreed != null ? `${xScale(i)},${yScale(g.agreed)}` : null).filter(Boolean).join(' ');
  const mlPts = grouped.map((g, i) => g.ml != null ? `${xScale(i)},${yScale(g.ml)}` : null).filter(Boolean).join(' ');

  // y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

  // trend badges
  const increased = grouped.filter(g => g.pct != null && Number(g.pct) > 0).length;
  const decreased = grouped.filter(g => g.pct != null && Number(g.pct) < 0).length;
  const neutral = grouped.filter(g => g.pct != null && Number(g.pct) === 0).length;

  const metricLabel = { min: 'Minimum', avg: 'Average', max: 'Maximum' }[metric];
  // UNIFORM BLUE COLOR FOR ML LINE (always #0891b2)
  const mlColor = '#0891b2';

  return (
    <div className="view">
      {/* Summary banner */}
      <div className="info-banner" style={{ borderColor: 'rgba(139,92,246,.25)', background: 'rgba(139,92,246,.04)' }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(139,92,246,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Price Trends — Agreed vs ML Model Price ({metricLabel})</div>
          <div style={{ fontSize: 12, color: '#4d7c77', lineHeight: 1.6 }}>
            Based on <strong>{records.length}</strong> stamped records. 
            Periods above model price: <span style={{ color: '#ef4444', fontWeight: 700 }}>{increased}</span> · 
            Below: <span style={{ color: '#16a34a', fontWeight: 700 }}>{decreased}</span> · 
            On-target: <span style={{ color: '#0891b2', fontWeight: 700 }}>{neutral}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['year','By Year'],['month','By Month']].map(([v, l]) => (
            <button key={v} className={`role-tab ${groupBy === v ? 'active' : ''}`} onClick={() => setGroupBy(v)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
          {[['min','Minimum'],['avg','Average'],['max','Maximum']].map(([v, l]) => (
            <button key={v} className={`role-tab ${metric === v ? 'active' : ''}`} onClick={() => setMetric(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Chart card */}
      <div className="card">
        <div className="card-hd" style={{ background: 'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          Price Trend Chart — {metricLabel} per {groupBy}
        </div>

        {loading && <div className="loading-state"><Ic.Spin /> Loading records…</div>}
        {!loading && grouped.length === 0 && (
          <div className="empty-state">No stamped records with valid dates found.</div>
        )}

        {!loading && grouped.length > 0 && (
          <div style={{ padding: '20px', overflowX: 'auto' }}>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[
                ['#ef4444', 'Agreed Price (actual)'],
                [mlColor, `ML Model Price (${metricLabel})`]
              ].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  <span style={{ width: 28, height: 3, background: c, borderRadius: 2, display: 'inline-block' }} />
                  {l}
                </div>
              ))}
            </div>

            {/* SVG Chart */}
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ minWidth: 480, display: 'block' }}>
              {/* Grid lines */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line x1={padL} y1={yScale(tick)} x2={chartW - padR} y2={yScale(tick)}
                    stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3" />
                  <text x={padL - 8} y={yScale(tick) + 4} textAnchor="end"
                    fontSize="11" fill="#6b7280">{fmt(tick)}</text>
                </g>
              ))}

              {/* X axis labels */}
              {grouped.map((g, i) => (
                <text key={i} x={xScale(i)} y={chartH - padB + 20}
                  textAnchor="middle" fontSize="11" fill="#6b7280">{g.period}</text>
              ))}

              {/* Area fill under agreed line */}
              {grouped.length > 1 && (
                <polygon
                  points={`${xScale(0)},${padT + innerH} ${agreedPts} ${xScale(grouped.length - 1)},${padT + innerH}`}
                  fill="rgba(239,68,68,.06)"
                />
              )}

              {/* ML line - UNIFORM BLUE */}
              {grouped.length > 1 && mlPts && (
                <polyline points={mlPts} fill="none" stroke={mlColor} strokeWidth="2.5" strokeLinejoin="round" />
              )}

              {/* Agreed line */}
              {grouped.length > 1 && agreedPts && (
                <polyline points={agreedPts} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />
              )}

              {/* Dots + tooltips */}
              {grouped.map((g, i) => (
                <g key={i}>
                  {g.agreed != null && (
                    <g>
                      <circle cx={xScale(i)} cy={yScale(g.agreed)} r="5" fill="white" stroke="#ef4444" strokeWidth="2.5" />
                      <title>{g.period} · Agreed: {fmtFull(g.agreed)}</title>
                    </g>
                  )}
                  {g.ml != null && (
                    <g>
                      <circle cx={xScale(i)} cy={yScale(g.ml)} r="4" fill="white" stroke={mlColor} strokeWidth="2" />
                      <title>{g.period} · ML {metricLabel}: {fmtFull(g.ml)}</title>
                    </g>
                  )}
                </g>
              ))}

              {/* Axes */}
              <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#d1d5db" strokeWidth="1.5" />
              <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#d1d5db" strokeWidth="1.5" />
            </svg>
          </div>
        )}
      </div>

      {/* Table card */}
      {!loading && grouped.length > 0 && (
        <div className="card">
          <div className="card-hd" style={{ background: 'linear-gradient(135deg,#0891b2,#0d9488)' }}>
            Detailed Period Breakdown — {metricLabel} Values
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Sales</th>
                  <th>Agreed Price ({metricLabel})</th>
                  <th>ML Model Price ({metricLabel})</th>
                  <th>Difference</th>
                  <th>Deviation %</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => {
                  const prev = i > 0 ? grouped[i - 1] : null;
                  const agreedChange = prev?.agreed && g.agreed ? g.agreed - prev.agreed : null;
                  const isUp = agreedChange > 0;
                  const isDown = agreedChange < 0;
                  const over = g.pct != null && Number(g.pct) > 0;
                  const under = g.pct != null && Number(g.pct) < 0;
                  return (
                    <tr key={g.period}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{g.period}</td>
                      <td style={{ color: '#4d7c77' }}>{g.count}</td>
                      <td style={{ fontWeight: 700, color: '#ef4444' }}>{fmtFull(g.agreed)}</td>
                      <td style={{ fontWeight: 700, color: mlColor }}>{fmtFull(g.ml)}</td>
                      <td style={{ fontWeight: 600, color: over ? '#ef4444' : under ? '#16a34a' : '#94a3b8' }}>
                        {g.diff != null ? (g.diff > 0 ? '+' : '') + Number(g.diff).toLocaleString() + ' RWF' : '—'}
                      </td>
                      <td>
                        {g.pct != null ? (
                          <span style={{ padding: '3px 10px', borderRadius: 40, fontSize: 12, fontWeight: 700,
                            background: over ? 'rgba(239,68,68,.1)' : under ? 'rgba(22,163,74,.1)' : 'rgba(8,145,178,.1)',
                            color: over ? '#ef4444' : under ? '#16a34a' : '#0891b2' }}>
                            {g.pct > 0 ? '+' : ''}{g.pct}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {agreedChange != null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                            color: isUp ? '#ef4444' : isDown ? '#16a34a' : '#94a3b8' }}>
                            {isUp ? '▲' : isDown ? '▼' : '—'}
                            {isUp ? 'Price Up' : isDown ? 'Price Down' : 'Flat'}
                            {agreedChange !== 0 && <span style={{ fontWeight: 400, fontSize: 11 }}>({fmt(Math.abs(agreedChange))})</span>}
                          </span>
                        ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>First entry</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ──
export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [pendingMutationsCount, setPendingMutationsCount] = useState(0);
  const [seenMutationsCount, setSeenMutationsCount] = useState(() => { 
    try { 
      return parseInt(localStorage.getItem('lpes_admin_seen_mutations') || '0', 10); 
    } catch { 
      return 0; 
    } 
  });

  const [active, setActive] = useState('dashboard');

    // FIXED: stats now includes notary_sector and notary_private separately
    const [stats, setStats] = useState({ total:0, district:0, notaries:0, notary_sector:0, notary_private:0, txs:0 });
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [suggestionCount, setSuggestionCount] = useState(0);
    const [seenSuggCount, setSeenSuggCount] = useState(() => { try { return parseInt(localStorage.getItem('lpes_admin_seen_sugg') || '0', 10); } catch { return 0; } });
    const [unreadReports, setUnreadReports] = useState(0);
    const [seenReportCount, setSeenReportCount] = useState(() => { try { const v = parseInt(localStorage.getItem('lpes_admin_seen_reports') || '0', 10); return v; } catch { return 0; } });
    const [reportsBadgeDismissed, setReportsBadgeDismissed] = useState(() => { try { return localStorage.getItem('lpes_admin_reports_dismissed') === 'true'; } catch { return false; } });
    const [suggBellOpen, setSuggBellOpen] = useState(false);
    const suggBellRef = useRef(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);
    const [profilePhoto, setProfilePhoto] = useState(null);
    const photoInputRef = useRef(null);

    // handleSetActive comes AFTER all state it depends on
    const handleSetActive = useCallback((id) => {
  setActive(id);
  if (id === 'suggestions') {
    setSeenSuggCount(suggestionCount);
    localStorage.setItem('lpes_admin_seen_sugg', String(suggestionCount));
  }
  if (id === 'reports') {
    setSeenReportCount(unreadReports);
    setReportsBadgeDismissed(true);
    localStorage.setItem('lpes_admin_seen_reports', String(unreadReports));
    localStorage.setItem('lpes_admin_reports_dismissed', 'true');
  }
  if (id === 'transactions') {  // Add this block
    setSeenMutationsCount(pendingMutationsCount);
    localStorage.setItem('lpes_admin_seen_mutations', String(pendingMutationsCount));
  }
}, [suggestionCount, unreadReports, pendingMutationsCount]);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`lpes_photo_admin_${user.id}`);
      if (saved) setProfilePhoto(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    function fn(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchStats = useCallback(() => {
    fetch(`${API}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // FIXED: map both notary breakdown fields from backend response
          setStats({
            ...d.stats,
            txs: d.stats.txs || 0,
            notary_sector:  d.stats.notary_sector  ?? 0,
            notary_private: d.stats.notary_private ?? 0,
            stamped_records: d.stats.stamped_records ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
    const u1 = eventBus.on('userChanged',       () => fetchStats());
    const u2 = eventBus.on('transactionChanged', () => fetchStats());
    return () => { u1(); u2(); };
  }, [fetchStats]);

  useEffect(() => {
    if (suggestionCount === 0) {
      setSeenSuggCount(0);
      localStorage.setItem('lpes_admin_seen_sugg', '0');
    }
  }, [suggestionCount]);

  useEffect(() => {
    if (unreadReports === 0) {
      setSeenReportCount(0);
      localStorage.setItem('lpes_admin_seen_reports', '0');
    }
  }, [unreadReports]);

  // Poll pending mutations count
useEffect(() => {
  function fetchPendingMutations() {
    fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const pending = (d.transactions || []).filter(t => t.status === 'pending').length;
          setPendingMutationsCount(pending);
        }
      }).catch(() => {});
  }
  fetchPendingMutations();
  const interval = setInterval(fetchPendingMutations, 15000);
  return () => clearInterval(interval);
}, []);

  // Poll suggestions count
  useEffect(() => {
    function fetchSuggCount() {
      fetch(`${API}/suggestions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => { if (d.success) setSuggestionCount((d.suggestions || []).length); })
        .catch(() => {});
    }
    fetchSuggCount();
    const interval = setInterval(fetchSuggCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll reports count
  useEffect(() => {
    function fetchReportCount() {
      fetch(`${API}/admin/inbox`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => { if (d.success) { const count = (d.reports || []).length; setUnreadReports(count); if (count > seenReportCount) { setReportsBadgeDismissed(false); localStorage.setItem('lpes_admin_reports_dismissed', 'false'); } } })
        .catch(() => {});
    }
    fetchReportCount();
    const interval = setInterval(fetchReportCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close sugg bell on outside click
  useEffect(() => {
    function fn(e) { if (suggBellRef.current && !suggBellRef.current.contains(e.target)) setSuggBellOpen(false); }
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  if (!user) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#f0fdfa' }}>
      <div style={{ color:'#0d9488', fontFamily:'"Times New Roman",Times,serif', fontSize:15, display:'flex', alignItems:'center', gap:10 }}><Ic.Spin /> Loading…</div>
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
      localStorage.setItem(`lpes_photo_admin_${user.id}`, data);
      addAlert('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  const initials = user?.name?.split(' ').filter(Boolean).slice(0,2).map(n => n[0]?.toUpperCase()).join('') || 'AD';

  const TITLES = {
    dashboard:'Overview', users:'All Users', district:'District Officers',
    land_parcels:'Land Parcels', locations:'Locations',
    sector_notaries:'Sector Notaries', private_notaries:'Private Notaries',
    transactions:'Mutations', stamped_records:'Stamped Records', predict:'Land & Estimation', suggestions:'Suggestions',
    price_trends: 'Price Trends',
    reports:'Reports Inbox', settings:'Settings',
  };

  function renderContent() {
    switch (active) {
      case 'dashboard':        return <ViewDashboard setActive={handleSetActive} stats={stats} />;
      case 'users':            return <ViewUsers addAlert={addAlert} />;
      case 'district':         return <ViewRoleManagement role="district_land_officer" accentColor="#0891b2" addAlert={addAlert} />;
      // FIXED: Two separate notary views, each filtered by notary_type
      case 'private_notaries': return <ViewRoleManagement role="notary" notaryType="private" accentColor="#a855f7" addAlert={addAlert} />;
      case 'land_parcels':     return <ViewLandParcels addAlert={addAlert} />;
      case 'locations':        return <ViewLocations addAlert={addAlert} />;
      case 'stamped_records':  return <ViewStampedRecords addAlert={addAlert} />;
      case 'transactions':     return <ViewTransactions addAlert={addAlert} user={user} />;
      case 'price_trends':     return <ViewPriceTrends addAlert={addAlert} />;
      case 'predict':          return <ViewPredict addAlert={addAlert} />;
      case 'suggestions':      return <ViewSuggestions addAlert={addAlert} />;
      case 'reports':          return <ViewReportsAndInbox addAlert={addAlert} />;
      case 'settings':         return <ViewSettings addAlert={addAlert} />;
      default:                 return <ViewDashboard setActive={setActive} stats={stats} />;
    }
  }

  return (
    <>
      <Head>
        <title>{TITLES[active]} — Admin · LPES</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>
      <ToastContainer alerts={alerts} removeAlert={removeAlert} />
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      {logoutConfirm && (
        <div className="m-overlay" onClick={() => setLogoutConfirm(false)}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth:360, textAlign:'center', padding:'32px 28px', position:'relative' }}>
            <button onClick={() => setLogoutConfirm(false)} className="x-close-btn" style={{ position:'absolute', top:16, right:16 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
            <div style={{ fontFamily:'"Times New Roman",Times,serif', fontSize:18, fontWeight:800, marginBottom:8 }}>Sign Out?</div>
            <div style={{ fontSize:13, color:'#4d7c77', marginBottom:24 }}>You will be redirected to the home page.</div>
            <button onClick={doLogout} className="logout-btn" style={{ width:'100%', padding:'12px 24px', borderRadius:12, border:'none', background:'#ef4444', color:'white', cursor:'pointer', fontFamily:'"Times New Roman",Times,serif', fontWeight:700, fontSize:14 }}>Yes, Sign Out</button>
          </div>
        </div>
      )}
      <style>{`
        :root{--teal:#0d9488;--teal-d:#0f766e;--teal-l:#f0fdfa;--cyan:#0891b2;--dark:#0c1a19;--g200:#ccf2ee;--g300:#99e6de;--g600:#4d7c77;--sh-sm:0 1px 3px rgba(13,148,136,.12);--sh-md:0 4px 12px rgba(13,148,136,.16);--sh-lg:0 10px 30px rgba(13,148,136,.20);--sh-xl:0 20px 50px rgba(13,148,136,.24);--r:12px;--rl:16px;--rxl:22px;--sb-w:260px;--nav:#0f172a;}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:"Times New Roman",Times,serif;background:#f0fdfa;color:#0c1a19}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}
        .shell{display:flex;flex-direction:column;height:100vh;overflow:hidden}
        .shell-body{display:flex;flex:1;overflow:hidden;min-height:0}
        .topbar{height:60px;background:var(--nav);display:flex;align-items:center;flex-shrink:0;z-index:200;border-bottom:1px solid rgba(255,255,255,.07);padding:0}
        .topbar-brand{width:var(--sb-w);flex-shrink:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;background:#00102a;border-bottom:3px solid white;border-radius:0 0 10px 10px}
        .topbar-brand-acronym{font-size:20px;font-weight:800;color:#60a5fa;font-family:"Times New Roman",Times,serif;letter-spacing:5px;font-style:italic;line-height:1.2;text-align:center}
        .topbar-brand-tagline{font-size:9px;color:rgba(255,255,255,.6);font-family:"Times New Roman",Times,serif;margin-top:4px;text-align:center;letter-spacing:.1px;font-style:italic}
        .topbar-expand-wrap{padding:0;flex-shrink:0;height:100%}
        .topbar-expand-btn{display:flex;align-items:center;justify-content:center;height:100%;width:80px;background:white;border:none;border-right:1px solid #e5e7eb;color:#374151;cursor:pointer;transition:background .15s;border-radius:0;padding-top:6px}
        .topbar-expand-btn:hover{background:#f3f4f6}
        .topbar-title{flex:1;font-size:14px;color:rgba(255,255,255,.65);font-family:"Times New Roman",Times,serif;font-style:italic;padding:0 16px}
        .topbar-user-wrap{position:relative;padding:0 16px;flex-shrink:0}
        .topbar-user{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:6px;background:white;border:1px solid #d1d5db;cursor:pointer;user-select:none;transition:background .18s;color:#1f2937}
        .topbar-user:hover{background:#f9fafb}
        .topbar-user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;flex-shrink:0}
        .topbar-user-name{font-size:13px;font-weight:600;color:#1f2937;font-family:"Times New Roman",Times,serif}
        .topbar-sep{color:#9ca3af;font-size:13px;margin:0 2px}
        .topbar-role{color:#6b7280;font-size:13px;font-family:"Times New Roman",Times,serif}
        .topbar-chev{color:#6b7280;display:flex;align-items:center;margin-left:4px}
        .user-dropdown{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);width:240px;background:white;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,.18);border:1px solid var(--g200);overflow:hidden;z-index:500}
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
        .sidebar{width:var(--sb-w);background:var(--nav);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.24s cubic-bezier(0.4,0,0.2,1);border-right:1px solid rgba(255,255,255,.06);overflow:hidden;white-space:nowrap}
        .sidebar-open{width:var(--sb-w)} .sidebar-closed{width:0}
        .sb-nav{flex:1;padding:14px 10px;overflow-y:auto;overflow-x:hidden}
        .sb-section{font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;padding:0 8px 10px;letter-spacing:.6px;white-space:nowrap}
        .sb-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:10px;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:13px;font-weight:500;cursor:pointer;margin-bottom:3px;font-family:"Times New Roman",Times,serif;text-align:left;transition:all .18s;white-space:nowrap}
        .sb-item:hover{background:rgba(255,255,255,.06);color:white}
        .sb-item.active{background:rgba(13,148,136,.2);color:#0d9488}
        .sb-item-alert{background:rgba(239,68,68,.07);}
        .sb-icon{display:flex;align-items:center;flex-shrink:0} .sb-label{flex:1} .sb-pip{width:5px;height:5px;border-radius:50%;background:#0d9488;flex-shrink:0}
        .main{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .content{flex:1;overflow-y:auto;padding:24px;padding-bottom:40px}
        .content::-webkit-scrollbar{width:5px} .content::-webkit-scrollbar-thumb{background:#0d9488;border-radius:3px}
        .view{display:flex;flex-direction:column;gap:18px;max-width:1100px;margin:0 auto;width:100%;padding-bottom:20px}
        .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
        .stat-card{background:white;border:1px solid var(--g200);border-radius:var(--rxl);padding:18px;box-shadow:var(--sh-sm)} .stat-card.clickable:hover{transform:translateY(-2px);box-shadow:var(--sh-md);border-color:var(--teal);cursor:pointer}
        .stat-value{font-size:28px;font-weight:800;color:#0c1a19} .stat-label{font-size:12px;font-weight:600;margin-top:4px} .stat-sub{font-size:11px;color:#4d7c77;margin-top:2px}
        .section-label{font-size:11px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .qa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .qa-card{background:white;border:1.5px solid var(--g200);border-radius:var(--rxl);padding:18px;cursor:pointer;text-align:left;transition:all .2s;font-family:"Times New Roman",Times,serif}
        .qa-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-md)}
        .qa-dot{width:10px;height:10px;border-radius:50%;margin-bottom:8px} .qa-label{font-size:14px;font-weight:700} .qa-desc{font-size:12px;color:#4d7c77;margin-top:4px}
        .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:hidden;animation:fadeUp .4s ease}
        .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:14px 20px;font-family:"Times New Roman",Times,serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:var(--rxl) var(--rxl) 0 0}
        .data-table{width:100%;border-collapse:collapse}
        .data-table th{text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#4d7c77;background:#f9fefd;border-bottom:1px solid #ccf2ee;white-space:nowrap}
        .data-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0fdfa;vertical-align:middle}
        .data-table tr:last-child td{border-bottom:none} .data-table tbody tr:hover{background:#f9fefd}
        .role-chip{padding:3px 10px;border-radius:40px;font-size:11px;font-weight:700;white-space:nowrap}
        .btn-p{display:flex;align-items:center;gap:7px;padding:10px 18px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap}
        .btn-p:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--sh-md)} .btn-p:disabled{opacity:.7;cursor:not-allowed}
        .btn-danger{display:flex;align-items:center;gap:7px;padding:8px 16px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap}
        .btn-danger:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(239,68,68,.3)}
        .btn-ghost{background:#f9fefd;border:1.5px solid var(--g200);padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;color:#4d7c77;font-family:inherit;transition:all .15s}
        .btn-ghost:hover{border-color:var(--teal);color:var(--teal)}
        .tbl-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;font-family:inherit;transition:all .15s}
        .tbl-edit{background:rgba(13,148,136,.1);color:var(--teal)} .tbl-edit:hover{background:rgba(13,148,136,.2)}
        .tbl-del{background:rgba(239,68,68,.08);color:#ef4444} .tbl-del:hover{background:rgba(239,68,68,.15)}
        .tbl-approve{background:rgba(34,197,94,.1);color:#16a34a} .tbl-approve:hover{background:rgba(34,197,94,.2)}
        .officer-card{display:flex;align-items:center;gap:14px;background:var(--teal-l);border:1px solid var(--g200);border-radius:12px;padding:12px 16px;margin-bottom:8px;transition:all .15s}
        .officer-card:hover{border-color:var(--teal)} .pending-card{background:#fffbeb;border-color:#fde68a}
        .oc-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px;flex-shrink:0}
        .sug-card{background:white;border:1px solid var(--g200);border-radius:14px;padding:16px 20px;box-shadow:var(--sh-sm);transition:box-shadow .18s}
        .sug-card:hover{box-shadow:var(--sh-md)}
        .report-card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:16px 20px;margin-bottom:0;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .18s,border-color .18s}
        .report-card:hover{box-shadow:var(--sh-md);border-color:var(--g200)}
        .info-banner{display:flex;gap:14px;background:rgba(13,148,136,.04);border:1px solid rgba(13,148,136,.15);border-radius:16px;padding:16px 20px;align-items:flex-start}
        .search-wrap-inline{display:flex;align-items:center;gap:6px;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);padding:6px 12px}
        .s-inp-sm{border:none;background:transparent;outline:none;font-size:13px;font-family:"Times New Roman",Times,serif;width:200px} .s-inp-sm::placeholder{color:#4d7c77;}
        .role-tab{padding:6px 14px;border-radius:40px;background:var(--teal-l);border:1.5px solid var(--g200);font-size:12px;font-weight:600;color:#4d7c77;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s;font-family:inherit}
        .role-tab:hover{border-color:var(--teal);color:var(--teal)} .role-tab.active{background:var(--teal);color:white;border-color:var(--teal)}
        .tab-count{background:rgba(255,255,255,.3);border-radius:40px;padding:1px 7px;font-size:11px}
        .role-tab:not(.active) .tab-count{background:rgba(13,148,136,.1);color:var(--teal)}
        .loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#4d7c77;font-size:14px}
        .empty-state{padding:40px;text-align:center;color:#4d7c77;font-size:14px}
        .m-overlay{position:fixed;inset:0;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
        .m-box{background:white;border-radius:var(--rxl);box-shadow:0 24px 60px rgba(0,0,0,.35);border:1px solid var(--g200);width:100%;max-width:480px;padding:30px;position:relative;animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both}
        .modal-close{background:#f9fefd;border:1px solid var(--g200);border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#4d7c77;transition:color .15s,background .15s,border-color .15s}
        .modal-close:hover{background:rgba(239,68,68,.08);color:#ef4444;border-color:#fca5a5}
        .f-inp{padding:10px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%}
        .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white}
        .confirm-box{background:white;border-radius:20px;width:100%;max-width:420px;padding:32px 28px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:10px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:mIn .2s ease}
        .confirm-icon{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px}
        .confirm-title{font-size:18px;font-weight:800;font-family:"Times New Roman",Times,serif} .confirm-msg{font-size:14px;color:#374151;line-height:1.5}
        .confirm-detail{font-size:12px;color:#4d7c77;background:#f9fefd;border:1px solid var(--g200);border-radius:8px;padding:10px 14px;width:100%;text-align:left;font-style:italic}
        .confirm-actions{display:flex;gap:10px;width:100%;margin-top:4px} .confirm-actions .btn-ghost{flex:1;text-align:center}
        .x-close-btn{background:none;border:none;cursor:pointer;color:#6b7280;display:flex;align-items:center;padding:6px;border-radius:6px;transition:color .15s,background .15s}
        .x-close-btn:hover{color:#ef4444;background:rgba(239,68,68,.1)}
        .no-tax{color:#16a34a;font-weight:600}
        .alert-e{background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:var(--r);padding:10px 14px;font-size:13px}
        .logout-btn{transition:background .2s,transform .15s}
        .logout-btn:hover{background:#dc2626 !important;transform:translateY(-1px)}
        @media(max-width:1100px){.stats-grid{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:900px){.stats-grid{grid-template-columns:1fr 1fr}.qa-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr}.qa-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="shell">
        <div className="topbar">
          <div className="topbar-brand">
            <div className="topbar-brand-acronym">L P E S</div>
            <div className="topbar-brand-tagline">Land Price Estimation System</div>
          </div>
          <div className="topbar-expand-wrap">
            <button className="topbar-expand-btn" onClick={() => setSidebarOpen(o => !o)}><Ic.Menu /></button>
          </div>
          <div className="topbar-title">A Machine Learning-Based Framework for Land Price Estimation</div>

          <div className="topbar-user-wrap" ref={userMenuRef} style={{ paddingRight: 16, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="topbar-user" onClick={() => setUserMenuOpen(o => !o)}>
              <div className="topbar-user-avatar">
                {profilePhoto
                  ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <span className="topbar-user-name">{user?.name}</span>
              <span className="topbar-sep">|</span>
              <span className="topbar-role">System Admin</span>
              <span className="topbar-chev"><Ic.ChevDown /></span>
            </div>
            {userMenuOpen && (
              <div className="user-dropdown" onClick={e => e.stopPropagation()}>
                <div className="ud-header">
                  <div className="ud-avatar-wrap" onClick={e => { e.stopPropagation(); photoInputRef.current?.click(); }} title="Click to change profile photo">
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
                  <div className="ud-role">System Admin</div>
                  {user?.email && <div className="ud-email">{user.email}</div>}
                </div>
                <button className="ud-signout" onClick={() => { setUserMenuOpen(false); setLogoutConfirm(true); }}>
                  <Ic.Logout /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="shell-body">
          <Sidebar
  active={active}
  sidebarOpen={sidebarOpen}
  setActive={handleSetActive}
  suggestionBadge={suggestionCount > seenSuggCount}
  reportBadge={!reportsBadgeDismissed && unreadReports > seenReportCount}
  mutationBadge={pendingMutationsCount > 0 && pendingMutationsCount > seenMutationsCount}
/>
          <div className="main"><div className="content">{renderContent()}</div></div>
        </div>
      </div>
    </>
  );
}