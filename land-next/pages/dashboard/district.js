// ============================================================
// DISTRICT DASHBOARD — pages/dashboard/district.js
// UPDATED: District manages Sector Officers ONLY (no notary)
// UPDATED: Same look as admin (topbar + collapsible sidebar)
// UPDATED: Can send reports to admin
// FIXED: Role redirect — each role goes to correct dashboard
// FIXED: ViewSector now uses /district/officers route
// ============================================================
import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const API = 'https://land-price-api-35fr.onrender.com';

// ── Auth ────────────────────────────────────────────────────
function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  useEffect(() => {
    const s = localStorage.getItem('lpe_user');
    if (!s) { router.replace('/'); return; }
    let u;
    try { u = JSON.parse(s); } catch { router.replace('/'); return; }
    if (u.role !== 'district_land_officer') {
      const map = {
        admin: '/dashboard/admin', system_admin: '/dashboard/admin',
        buyer_seller: '/dashboard/buyer',
        sector_land_officer: '/dashboard/sector',
        notary: '/dashboard/notary'
      };
      router.replace(map[u.role] || '/');
      return;
    }
    setUser(u);
  }, []);
  return { user };
}

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
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.type === 'success' ? 'rgba(13,148,136,.1)' : a.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b', flexShrink:0 }}>
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

// ── Icons ────────────────────────────────────────────────────
const Ic = {
  Home:     () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Map:      () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
  Monitor:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Report:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
  Inbox:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  Logout:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Check:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  X:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Eye:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>,
  Spin:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Refresh:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  Add:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Trash:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Search:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Send:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Download: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Menu:     () => <svg width="22" height="18" viewBox="0 0 22 18" fill="none"><path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor"/><rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor"/><rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor"/><rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor"/></svg>,
  ChevDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Edit:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  MapPin:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',       icon: 'Home'    },
  { id: 'sector',       label: 'Sector Officers', icon: 'Users'   },
  { id: 'land_parcels', label: 'Land Parcels',    icon: 'MapPin'  },
  { id: 'landdata',     label: 'Land & Estimation', icon: 'Map'   },
  { id: 'mutations',    label: 'Mutations',       icon: 'Monitor' },
  { id: 'inbox',        label: 'Reports Inbox',   icon: 'Inbox'   },
];

// ── Sidebar (same admin format) ──────────────────────────────
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

// ── Add Sector Officer Modal ─────────────────────────────────
function AddSectorModal({ user, onConfirm, onCancel, addAlert }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', sector_id: '', sector_name: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [districtId, setDistrictId] = useState(null);
  const [fetchingDistrict, setFetchingDistrict] = useState(true);

  // Get district officer's district ID from the user's profile
  useEffect(() => {
    async function getDistrictId() {
      if (!user?.id) {
        setFetchingDistrict(false);
        return;
      }
      
      try {
        // First try to get user's full profile from /auth/me
        const r = await fetch(`${API}/auth/me`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        const d = await r.json();
        
        if (d.success && d.user) {
          // Check if user has district_id directly
          if (d.user.district_id) {
            setDistrictId(d.user.district_id);
            setFetchingDistrict(false);
            return;
          }
          
          // If user has district_name, find the district ID by name
          if (d.user.district_name) {
            const districtsRes = await fetch(`${API}/locations/districts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}'
            });
            const districtsData = await districtsRes.json();
            if (districtsData.success) {
              const match = districtsData.districts.find(dist => dist.name === d.user.district_name);
              if (match) {
                setDistrictId(match.id);
                setFetchingDistrict(false);
                return;
              }
            }
          }
        }
        
        // Fallback: If user has district_name directly from login
        if (user?.district_name) {
          const districtsRes = await fetch(`${API}/locations/districts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          });
          const districtsData = await districtsRes.json();
          if (districtsData.success) {
            const match = districtsData.districts.find(dist => dist.name === user.district_name);
            if (match) {
              setDistrictId(match.id);
              setFetchingDistrict(false);
              return;
            }
          }
        }
        
        // If still no district, show error
        addAlert('Could not determine your district. Please contact admin.', 'error');
      } catch (err) {
        console.error('Error fetching district:', err);
        addAlert('Error loading district information', 'error');
      } finally {
        setFetchingDistrict(false);
      }
    }
    
    getDistrictId();
  }, [user]);

  // Load sectors that belong to this district officer's district only
  useEffect(() => {
    if (!districtId) {
      setSectors([]);
      return;
    }
    setLoadingSectors(true);
    fetch(`${API}/locations/sectors/by-district`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district_id: parseInt(districtId) })
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setSectors(d.sectors || []);
          if (d.sectors?.length === 0) {
            addAlert('No sectors found in your district. Please contact admin to add sectors.', 'warning');
          }
        } else {
          addAlert(d.message || 'Failed to load sectors', 'error');
          setSectors([]);
        }
      })
      .catch(() => addAlert('Cannot connect to server', 'error'))
      .finally(() => setLoadingSectors(false));
  }, [districtId]);

  const h = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'email') setErrors(ev => ({ ...ev, email: validateEmail(value) ? '' : 'Use Gmail, Yahoo, Outlook, or a .rw email.' }));
    if (name === 'phone' && value) { const r = validatePhone(value); setErrors(ev => ({ ...ev, phone: r.ok ? '' : r.msg })); }
    if (name === 'password') { const r = validatePassword(value, form.full_name, form.email); setErrors(ev => ({ ...ev, password: r.ok ? '' : r.msg })); }
    if (name === 'sector_id') {
      const selectedSector = sectors.find(s => String(s.id) === String(value));
      setForm(f => ({ ...f, sector_id: value, sector_name: selectedSector?.name || '' }));
    }
  };

  async function submit(e) {
    e.preventDefault();
    const emailErr = validateEmail(form.email) ? '' : 'Use Gmail, Yahoo, Outlook, or a .rw email.';
    let phoneErr = '';
    if (form.phone) {
      const formattedPhone = '+250' + form.phone;
      const validation = validatePhone(formattedPhone);
      phoneErr = validation.ok ? '' : validation.msg;
    }
    const pwRes    = validatePassword(form.password, form.full_name, form.email);
    const newErrs  = { email: emailErr, phone: phoneErr, password: pwRes.ok ? '' : pwRes.msg };
    
    if (!form.sector_name) newErrs.sector = 'Please select a sector';
    
    setErrors(newErrs);
    if (Object.values(newErrs).some(Boolean)) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/register`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          ...form, 
          phone: form.phone ? '+250' + form.phone : '',
          role: 'sector_land_officer',  // ← FIXED
          sector_id: form.sector_id,
          sector_name: form.sector_name,
          district_name: user?.district_name || ''
        }) 
      });
      const d = await r.json();
      if (d.success) {
        const newUserId = d.user_id || d.id || d.data?.id || d.data?.user_id;
        if (newUserId) {
          await fetch(`${API}/admin/users/update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: newUserId, status: 'approved' })
          });
        } else {
          try {
            const listRes = await fetch(`${API}/admin/users`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            });
            const listData = await listRes.json();
            const match = (listData.users || []).find(u => u.email === form.email);
            if (match?.id) {
              await fetch(`${API}/admin/users/update`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: match.id, status: 'approved' })
              });
            }
          } catch { /* silent fallback */ }
        }
        addAlert('Sector Notary added & approved!', 'success'); 
        onConfirm();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }

  return (
    <div className="m-overlay">
      <div className="m-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Add Sector Officer</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Register & auto-approve</div>
          </div>
          <button className="modal-close" onClick={onCancel}><Ic.X /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['full_name','Full Name','Jean Habimana','text'],['email','Email','notary@example.rw','email'],['password','Password','Min 8 chars','password']].map(([n,l,p,t]) => (
            <div key={n}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{l}</label>
              <input className="f-inp" name={n} value={form[n]} onChange={h} placeholder={p} required type={t} />
              {errors[n] && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors[n]}</div>}
              {!errors[n] && n === 'email' && form[n] && validateEmail(form[n]) && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Valid email</div>}
              {!errors[n] && n === 'password' && form[n] && validatePassword(form[n], form.full_name, form.email).ok && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Strong password</div>}
            </div>
          ))}

          {/* Phone with +250 prefix */}
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
        // Validate the full number format (what will be submitted)
        if (digits && digits.length === 9) {
          const prefix = digits.slice(0, 2);
          if (!['72','73','78','79'].includes(prefix)) {
            setErrors(ev => ({ ...ev, phone: 'Phone prefix must be 72/73 (TIGO) or 78/79 (MTN).' }));
          } else if (digits[0] !== '7') {
            setErrors(ev => ({ ...ev, phone: 'Phone must start with 7 — MTN: 78/79, TIGO: 72/73.' }));
          } else {
            setErrors(ev => ({ ...ev, phone: '' }));
          }
        } else if (digits && digits.length > 0 && digits.length < 9) {
          setErrors(ev => ({ ...ev, phone: `Enter ${9 - digits.length} more digit(s)` }));
        } else {
          setErrors(ev => ({ ...ev, phone: '' }));
        }
      }}
    />
  </div>
  {errors.phone && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.phone}</div>}
  {!errors.phone && form.phone && form.phone.length === 9 && form.phone[0] === '7' && ['72','73','78','79'].includes(form.phone.slice(0,2)) && (
    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 3 }}>✓ Valid phone number (+250{form.phone})</div>
  )}
</div>
          
          {/* Sector dropdown - only sectors in this district */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Sector of Work *</label>
            <select 
              className="f-inp" 
              name="sector_id" 
              value={form.sector_id} 
              onChange={h} 
              required 
              disabled={fetchingDistrict || loadingSectors || !districtId}
            >
              <option value="">— Select Sector —</option>
              {fetchingDistrict && !districtId && <option disabled>Loading your district...</option>}
              {!fetchingDistrict && !districtId && <option disabled>Could not determine your district</option>}
              {loadingSectors && <option disabled>Loading sectors...</option>}
              {!loadingSectors && !fetchingDistrict && districtId && sectors.length === 0 && <option disabled>No sectors available in your district</option>}
              {!loadingSectors && !fetchingDistrict && sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.sector && <div style={{ fontSize: 11, color: '#be123c', marginTop: 3 }}>{errors.sector}</div>}
          </div>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button 
              className="btn-p" 
              type="submit" 
              disabled={loading || fetchingDistrict || !districtId || sectors.length === 0} 
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Add /> Add Sector Officer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ReasonModal (Approve/Suspend) ────────────────────────────
function ReasonModal({ person, action, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const isSuspend = action === 'suspended';
  const presets = isSuspend
    ? ['Misconduct or unprofessional behavior', 'Inaccurate data submissions', 'Failure to comply with guidelines', 'Under investigation']
    : ['Review completed — all clear', 'Issues resolved', 'Reinstated by district order'];
  return (
    <div className="m-overlay">
      <div className="m-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>{isSuspend ? 'Suspend' : 'Approve'} Officer</div>
            <div style={{ fontSize: 12, color: '#4d7c77' }}>{person?.full_name}</div>
          </div>
          <button className="modal-close" onClick={onCancel}><Ic.X /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px' }}>Reason *</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {presets.map(p => (
              <button key={p} onClick={() => setReason(p)} style={{ padding: '9px 14px', textAlign: 'left', border: `1.5px solid ${reason === p ? (isSuspend ? '#ef4444' : '#0d9488') : '#ccf2ee'}`, borderRadius: 10, background: reason === p ? (isSuspend ? 'rgba(239,68,68,0.05)' : 'rgba(13,148,136,0.05)') : 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}>{p}</button>
            ))}
          </div>
          <textarea className="f-inp" rows={3} style={{ resize: 'none' }} placeholder="Or type a custom reason…" value={reason} onChange={e => setReason(e.target.value)} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button disabled={!reason.trim()} onClick={() => onConfirm(reason)} style={{ flex: 1, padding: '10px 18px', background: isSuspend ? '#ef4444' : '#0d9488', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: reason.trim() ? 'pointer' : 'not-allowed', opacity: reason.trim() ? 1 : 0.6, fontFamily: 'inherit' }}>
              {isSuspend ? 'Suspend Officer' : 'Approve Officer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard View ───────────────────────────────────────────
function ViewDashboard({ setActive, stats }) {
  return (
    <div className="view">
      <div className="stats-grid">
        {[
          { label: 'Sector Officers', value: stats.officers ?? 0, color: '#0d9488', sub: 'active officers', clickable: true, target: 'sector' },
          { label: 'Land Parcels',    value: stats.parcels  ?? 0, color: '#0891b2', sub: 'in district', clickable: true, target: 'land_parcels' },
          { label: 'Mutations',       value: stats.mutations?? 0, color: '#f59e0b', sub: 'total transfers', clickable: true, target: 'mutations' },
          { label: 'Reports Sent',    value: stats.reports  ?? 0, color: '#7c3aed', sub: 'to admin', clickable: true, target: 'inbox' },
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
          { label: 'Sector Officers', desc: 'Add & manage sector staff',         id: 'sector',    color: '#0d9488' },
          { label: 'View Land Data',  desc: 'Search parcels in your district',   id: 'landdata',  color: '#0891b2' },
          { label: 'Mutations',       desc: 'Monitor land transfer records',     id: 'mutations', color: '#f59e0b' },
          { label: 'Land Parcels',    desc: 'Register & manage UPIs for users',  id: 'land_parcels', color: '#0891b2' },
          { label: 'Reports Inbox',   desc: 'View received reports',                id: 'inbox',     color: '#22c55e' },
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

// ── Sector Officers View ─────────────────────────────────────
// FIXED: uses /district/officers with user_id instead of /admin/users/by-role
function ViewSector({ user, addAlert }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [reasonModal, setReasonModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      // Use /admin/users/by-role — confirmed working endpoint
      const r = await fetch(`${API}/admin/users/by-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'notary', notary_type: 'sector' })
      });
      const d = await r.json();
      if (d.success) setPeople(d.users || []);
      else addAlert(d.message || 'Failed to load officers', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }

  async function handleReason(reason) {
    const { person, action } = reasonModal; setReasonModal(null);
    try {
      await fetch(`${API}/admin/users/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: person.id, status: action, suspend_reason: reason }) });
      setPeople(prev => prev.map(p => p.id === person.id ? { ...p, status: action } : p));
      addAlert(`${person.full_name} ${action}!`, 'success');
    } catch { addAlert('Action failed', 'error'); }
  }

  async function doDelete(p) {
    setConfirmDelete(null);
    try {
      await fetch(`${API}/admin/users/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: p.id }) });
      load(); addAlert(`${p.full_name} removed.`, 'success');
    } catch { addAlert('Delete failed', 'error'); }
  }

  useEffect(() => { load(); }, [user?.id]);

  const pending   = people.filter(p => p.status === 'pending');
  const approved  = people.filter(p => p.status === 'approved');
  const suspended = people.filter(p => p.status === 'suspended');

  return (
    <div className="view">
      {showAdd && <AddSectorModal user={user} addAlert={addAlert} onConfirm={() => { setShowAdd(false); load(); }} onCancel={() => setShowAdd(false)} />}
      {reasonModal && <ReasonModal person={reasonModal.person} action={reasonModal.action} onConfirm={handleReason} onCancel={() => setReasonModal(null)} />}
      {confirmDelete && <ConfirmDialog title="Remove Officer" message={`Remove ${confirmDelete.full_name}?`} detail="This cannot be undone." confirmText="Yes, Remove" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}

      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Users /> Sector Officers ({people.length})</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-p" onClick={() => setShowAdd(true)}><Ic.Add /> Add Officer</button>
          </div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}

        {!loading && pending.length > 0 && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.4px', padding: '14px 0 8px', display:'flex', alignItems:'center', gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Pending Approval ({pending.length})
            </div>
            {pending.map(p => (
              <div key={p.id} className="officer-card pending-card">
                <div className="oc-avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>{p.full_name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>{p.email} · {fmtDate(p.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="tbl-btn tbl-approve" onClick={() => setReasonModal({ person: p, action: 'approved' })}><Ic.Check /> Approve</button>
                  <button className="tbl-btn tbl-del" onClick={() => setReasonModal({ person: p, action: 'suspended' })}><Ic.X /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && approved.length > 0 && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.4px', padding: '14px 0 8px' }}>✓ Active Officers ({approved.length})</div>
            {approved.map(p => (
              <div key={p.id} className="officer-card">
                <div className="oc-avatar">{p.full_name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>
                    {p.email}
                    {p.sector_name ? ` · Sector: ${p.sector_name}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="tbl-btn tbl-del" style={{ background: 'rgba(245,158,11,.08)', color: '#f59e0b' }} onClick={() => setReasonModal({ person: p, action: 'suspended' })}>Suspend</button>
                  <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(p)}><Ic.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && suspended.length > 0 && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.4px', padding: '14px 0 8px', display:'flex', alignItems:'center', gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              Suspended ({suspended.length})
            </div>
            {suspended.map(p => (
              <div key={p.id} className="officer-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                <div className="oc-avatar" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>{p.full_name?.[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>{p.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="tbl-btn tbl-approve" onClick={() => setReasonModal({ person: p, action: 'approved' })}><Ic.Check /> Reinstate</button>
                  <button className="tbl-btn tbl-del" onClick={() => setConfirmDelete(p)}><Ic.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && people.length === 0 && (
          <div className="empty-state">No sector officers yet.<br />
            <button className="btn-p" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Add First Officer</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Land Parcels View (District registers UPIs for users) ──
function ViewLandParcels({ user, addAlert }) {
  const [locationError, setLocationError] = useState('');
  const [parcels, setParcels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const emptyForm = { upi:'', user_id:'', owner_national_id:'', owner_name:'', owner_sex:'', province:'', district:'', sector:'', cell:'', village:'', x:'', y:'', area_m2:'', land_use:'', zoning:'', zoning_percentage:'', sentlement:'', sentlement_percentage:'', minimum_value_per_sqm:'', weighted_average_value_per_sqm:'', maximum_value_per_sqm:'' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDrop, setShowUserDrop] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [pRes, uRes] = await Promise.all([
        fetch(`${API}/admin/land-parcels`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }),
        fetch(`${API}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }),
      ]);
      const [pData, uData] = await Promise.all([pRes.json(), uRes.json()]);
      if (pData.success) setParcels(pData.parcels || []);
      if (uData.success) setUsers((uData.users || []).filter(u => u.role === 'buyer_seller'));
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const h = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    if (['province', 'district', 'sector'].includes(e.target.name)) {
      setLocationError('');
    }
  };

  async function handleUpiChange(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, upi: val }));
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
            zoning_percentage:     p['Zoning_%']     ?? f.zoning_percentage,
            sentlement:            p.Settlement !== 'N/A' ? p.Settlement : f.sentlement,
            sentlement_percentage: p['Settlement_%'] ?? f.sentlement_percentage,
            minimum_value_per_sqm:          p.Min_Value_Sqm || f.minimum_value_per_sqm,
            weighted_average_value_per_sqm: p.Avg_Value_Sqm || f.weighted_average_value_per_sqm,
            maximum_value_per_sqm:          p.Max_Value_Sqm || f.maximum_value_per_sqm,
          }));
        }
      } catch { }
    }
  }

  function resetForm() { setForm(emptyForm); setUserSearch(''); setShowUserDrop(false); }

  // Auto-fill user when national ID is typed
  async function handleNationalIdChange(e) {
  const val = e.target.value;
  setForm(f => ({ ...f, owner_national_id: val }));

  if (val.length === 16 && val[0] === '1') {
    const year = parseInt(val.slice(1, 5), 10);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return;

    const sexCode = parseInt(val.slice(5, 8), 10);
    let detectedSex = null;
    if (sexCode >= 800 && sexCode <= 899) detectedSex = 'Male';
    else if (sexCode >= 700 && sexCode <= 799) detectedSex = 'Female';
    else return;

    const match = users.find(u =>
      (u.national_id && u.national_id === val.trim()) ||
      (u.owner_national_id && u.owner_national_id === val.trim()) ||
      (u.id_number && u.id_number === val.trim())
    );
    if (match) {
      setForm(f => ({
        ...f,
        owner_national_id: val,
        user_id: match.id,
        owner_name: match.full_name || f.owner_name,
        owner_sex: detectedSex,
      }));
      setUserSearch('');
      setShowUserDrop(false);
    } else {
      setForm(f => ({ ...f, owner_sex: detectedSex }));
    }
  } else if (val.length === 0) {
    setForm(f => ({ ...f, owner_sex: '' }));
  }
}

  async function saveParcel(isEdit = false) {
    if (!form.upi.trim()) { addAlert('UPI is required', 'error'); return; }
    if (!form.user_id) { addAlert('Please assign to a user', 'error'); return; }
    if (!form.area_m2) { addAlert('Area is required', 'error'); return; }
    if (!form.land_use.trim()) { addAlert('Land use is required', 'error'); return; }
    // ← ADD THIS BLOCK
  if (!isEdit || (editModal && form.upi.trim() !== editModal.upi)) {
    const duplicate = parcels.find(
      p => p.upi?.trim() === form.upi.trim() && (!isEdit || p.id !== editModal?.id)
    );
    if (duplicate) {
      addAlert(
        `UPI ${form.upi} is already assigned to ${duplicate.owner_name || 'another user'}. Each UPI can only be assigned once.`,
        'error'
      );
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
        setShowAdd(false); setEditModal(null); resetForm(); load();
      } else {
        // Check if it's a location-not-found error
        const isLocationError = d.message && (
          d.message.includes('not found in the system') ||
          d.message.includes('Locations and create it first')
        );
        if (isLocationError) {
          setLocationError(d.message);
        } else {
          addAlert(d.message || 'Failed', 'error');
        }
      }
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
    setForm({ upi: p.upi||'', user_id: p.owner_id||'', owner_national_id: p.owner_national_id||'', owner_name: p.owner_name||'', owner_sex: p.owner_sex||'', province: p.province||'', district: p.district||'', sector: p.sector||'', cell: p.cell||'', village: p.village||'', x: p.x||'', y: p.y||'', area_m2: p.area_in_meter_square||'', land_use: p.land_use||'', zoning: p.zoning||'', zoning_percentage: p.zoning_percentage||'', sentlement: p.sentlement||'', sentlement_percentage: p.sentlement_percentage||'', minimum_value_per_sqm: p.minimum_value_per_sqm||'', weighted_average_value_per_sqm: p.weighted_average_value_per_sqm||'', maximum_value_per_sqm: p.maximum_value_per_sqm||'' });
    setUserSearch('');
    setEditModal(p);
  }

  const maskUpi = upi => {
    if (!upi) return '—';
    return upi.split('/').map(seg => 'x'.repeat(seg.length)).join('/');
  };

  const filtered = parcels.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.upi||'').toLowerCase().includes(q) || (p.owner_name||'').toLowerCase().includes(q);
  });

  const selectedUser = users.find(u => String(u.id) === String(form.user_id));
  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const showForm = showAdd || !!editModal;
  const isEdit = !!editModal;

  return (
    <div className="view">
      {showForm && (
        <div className="m-overlay">
          <div className="m-box" style={{ maxWidth:600, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <style>{`.dist-parcel-scroll::-webkit-scrollbar{display:none}`}</style>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, fontFamily:'"Times New Roman",Times,serif' }}>{isEdit ? 'Edit Parcel' : 'Register New UPI'}</div>
                <div style={{ fontSize:12, color:'#4d7c77', marginTop:2 }}>{isEdit ? `UPI: ${editModal?.upi}` : 'Assign land parcel to a user'}</div>
              </div>
              <button className="x-close-btn" onClick={() => { setShowAdd(false); setEditModal(null); resetForm(); setLocationError(''); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="dist-parcel-scroll" style={{ overflowY:'auto', flex:1, paddingRight:2, scrollbarWidth:'none', msOverflowStyle:'none' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* UPI */}
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>UPI *</label>
                  <input className="f-inp" name="upi" value={form.upi} onChange={handleUpiChange} placeholder="e.g. x/xx/xx/xx/xxxx" style={{ fontFamily:'monospace' }} />
                </div>
                {/* Assign to User — searchable */}
                <div style={{ position:'relative' }}>
                  <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Assign to User *</label>
                  <div style={{ position:'relative' }}>
                    <input
                      className="f-inp"
                      placeholder="Search user by name or email…"
                      value={selectedUser ? `${selectedUser.full_name} (${selectedUser.email})` : userSearch}
                      onChange={e => { setUserSearch(e.target.value); setShowUserDrop(true); setForm(f => ({ ...f, user_id: '' })); }}
                      onFocus={() => setShowUserDrop(true)}
                      style={{ paddingRight:30 }}
                    />
                    {form.user_id && (
                      <button onClick={() => { setForm(f => ({ ...f, user_id:'' })); setUserSearch(''); }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18, lineHeight:1 }}>×</button>
                    )}
                  </div>
                  {showUserDrop && !form.user_id && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid #ccf2ee', borderRadius:12, zIndex:100, maxHeight:180, overflowY:'auto', boxShadow:'0 8px 24px rgba(13,148,136,.15)', scrollbarWidth:'none' }}>
                      <style>{`.dist-user-drop::-webkit-scrollbar{display:none}`}</style>
                      <div className="dist-user-drop" style={{ overflowY:'auto', maxHeight:180, scrollbarWidth:'none' }}>
                        {filteredUsers.length === 0 && <div style={{ padding:'12px 14px', fontSize:12, color:'#94a3b8' }}>No users found</div>}
                        {filteredUsers.map(u => (
                          <div key={u.id} onClick={() => { setForm(f => ({ ...f, user_id: u.id, owner_name: f.owner_name || u.full_name, owner_sex: f.owner_sex || u.sex || '', owner_national_id: f.owner_national_id || u.national_id || u.owner_national_id || u.id_number || '' })); setUserSearch(''); setShowUserDrop(false); }} style={{ padding:'10px 14px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f0fdfa', display:'flex', flexDirection:'column', gap:2 }} onMouseEnter={e => e.currentTarget.style.background='#f0fdfa'} onMouseLeave={e => e.currentTarget.style.background='white'}>
                            <span style={{ fontWeight:700 }}>{u.full_name}</span>
                            <span style={{ fontSize:11, color:'#4d7c77', fontFamily:'monospace' }}>{u.email}</span>
                          </div>
                        ))}
                      </div>
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
                    {form.owner_national_id.length > 0 && form.owner_national_id.length < 16 && (
                      <div style={{ fontSize:11, color:'#f59e0b', marginTop:3 }}>⚠ Enter all 16 digits ({form.owner_national_id.length}/16)</div>
                    )}
                    {form.owner_national_id.length === 16 && form.owner_national_id[0] !== '1' && (
                      <div style={{ fontSize:11, color:'#ef4444', marginTop:3 }}>✕ ID must start with 1</div>
                    )}
                    {form.owner_national_id.length === 16 && form.owner_national_id[0] === '1' && (() => {
                      const year = parseInt(form.owner_national_id.slice(1,5),10);
                      const sexCode = parseInt(form.owner_national_id.slice(5,8),10);
                      const currentYear = new Date().getFullYear();
                      if (year < 1900 || year > currentYear) return <div style={{ fontSize:11, color:'#ef4444', marginTop:3 }}>✕ Invalid birth year in ID</div>;
                      if (!((sexCode>=700&&sexCode<=799)||(sexCode>=800&&sexCode<=899))) return <div style={{ fontSize:11, color:'#ef4444', marginTop:3 }}>✕ Invalid sex code in ID</div>;
                      const sex = sexCode>=800 ? 'Male' : 'Female';
                      return <div style={{ fontSize:11, color:'#16a34a', marginTop:3 }}>✓ Valid ID — detected sex: {sex}</div>;
                    })()}
                  </div>
                </div>
                {/* Sex */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>Owner Sex</label>
                  <select className="f-inp" name="owner_sex" value={form.owner_sex || ''} onChange={h}>
                    <option value="">— Select sex —</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                {/* Location */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Province</label>
                    <input className="f-inp" name="province" value={form.province} onChange={h} placeholder="e.g. Southern Province" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>District</label>
                    <input className="f-inp" name="district" value={form.district} onChange={h} placeholder="e.g. Huye" />
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Sector</label>
                    <input className="f-inp" name="sector" value={form.sector} onChange={h} placeholder="e.g. Mbazi" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Cell</label>
                    <input className="f-inp" name="cell" value={form.cell} onChange={h} placeholder="e.g. Cyarumbo" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Village</label>
                    <input className="f-inp" name="village" value={form.village} onChange={h} placeholder="e.g. Karama" />
                  </div>
                </div>
                {/* Coordinates */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>X Coordinate</label>
                    <input className="f-inp" name="x" type="number" value={form.x} onChange={h} placeholder="e.g. 29.7391" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Y Coordinate</label>
                    <input className="f-inp" name="y" type="number" value={form.y} onChange={h} placeholder="e.g. -2.5931" />
                  </div>
                </div>
                {/* Area + Land Use */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Area (m²) *</label>
                    <input className="f-inp" name="area_m2" type="number" value={form.area_m2} onChange={h} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Land Use *</label>
                    <input className="f-inp" name="land_use" value={form.land_use} onChange={h} placeholder="e.g. residential" />
                  </div>
                </div>
                {/* Zoning */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Zoning</label>
                    <input className="f-inp" name="zoning" value={form.zoning} onChange={h} placeholder="e.g. R1" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Zoning %</label>
                    <input className="f-inp" name="zoning_percentage" type="number" value={form.zoning_percentage} onChange={h} placeholder="e.g. 80" />
                  </div>
                </div>
                {/* Settlement */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Settlement</label>
                    <input className="f-inp" name="sentlement" value={form.sentlement} onChange={h} placeholder="e.g. rural_settlement" />
                  </div>
                  <div>
                    <label style={{ fontSize:10, fontWeight:700, color:'#4d7c77', textTransform:'uppercase', letterSpacing:'.4px', display:'block', marginBottom:4 }}>Settlement %</label>
                    <input className="f-inp" name="sentlement_percentage" type="number" value={form.sentlement_percentage} onChange={h} placeholder="e.g. 60" />
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
            {locationError && (
              <div style={{
                background: '#fef3c7',
                border: '1.5px solid #f59e0b',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                marginTop: 4,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                    Location Not Found
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    {locationError}
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', marginTop: 6, fontStyle: 'italic' }}>
                    Please contact your system administrator to import or create the required locations before registering this parcel.
                  </div>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:14, flexShrink:0 }}>
              <button className="btn-p" onClick={() => saveParcel(isEdit)} disabled={saving} style={{ flex:1, justifyContent:'center' }}>
                {saving ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> {isEdit ? 'Save Changes' : 'Register Parcel'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Parcel"
          message={`Delete UPI: ${confirmDelete.upi}?`}
          detail={`Owner: ${confirmDelete.owner_name || 'Unassigned'}`}
          confirmText="Yes, Delete"
          confirmColor="#ef4444"
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div className="card">
        <div className="card-hd" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><Ic.MapPin /> Land Parcels ({filtered.length})</span>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:12, padding:'6px 12px' }}>
              <Ic.Search />
              <input className="lp-search" style={{ border:'none', background:'transparent', outline:'none', fontSize:13, fontFamily:'"Times New Roman",Times,serif', width:180, color:'white', caretColor:'white' }} placeholder="Search UPI or owner…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-p" onClick={() => { setShowAdd(true); setEditModal(null); resetForm(); }} style={{ background:'rgba(255,255,255,.2)', border:'1px solid rgba(255,255,255,.4)' }}>
              <Ic.Add /> Register UPI
            </button>
          </div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading parcels…</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">No parcels registered yet.<br />
            <button className="btn-p" style={{ marginTop:12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Register First UPI</button>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>UPI</th><th>Owner</th><th>Area (m²)</th><th>Land Use</th><th>Zoning</th><th>Min/m²</th><th>Avg/m²</th><th>Max/m²</th><th>Transferred</th><th style={{ minWidth:120 }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily:'monospace', fontWeight:700, color:'#0891b2', fontSize:12 }}>{p.upi}</td>
                    <td style={{ fontSize:13 }}>{p.owner_name || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>Unassigned</span>}</td>
                    <td style={{ fontSize:12 }}>{p.area_in_meter_square ? Number(p.area_in_meter_square).toLocaleString() : '—'}</td>
                    <td style={{ fontSize:12 }}>{p.land_use || '—'}</td>
                    <td style={{ fontSize:12 }}>{p.zoning || '—'}</td>
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
  
// ── View Land Data ───────────────────────────────────────────
function ViewLandData({ addAlert }) {
  const [upi, setUpi] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [predLoad, setPredLoad] = useState(false);
  const [preds, setPreds] = useState(null);
  const [predErr, setPredErr] = useState('');
  const [showPreds, setShowPreds] = useState(false);

  async function estimatePrice(upiValue) {
    setPredLoad(true); setPreds(null); setPredErr('');
    try {
      const r = await fetch(`${API}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upiValue }) });
      const d = await r.json();
      if (d.success) setPreds(d);
      else setPredErr(d.message || 'Prediction failed');
    } catch { setPredErr('Cannot connect.'); }
    setPredLoad(false);
  }

  async function handleSearch(e) {
    e.preventDefault(); setData(null); setPreds(null); setPredErr(''); setShowPreds(false); setLoading(true);
    try {
      const r = await fetch(`${API}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upi.trim() }) });
      const d = await r.json();
      if (d.success) { setData(d.data); await estimatePrice(d.data.UPI); }
      else addAlert(d.message || 'UPI not found.', 'error');
    } catch { addAlert('Cannot connect.', 'error'); }
    setLoading(false);
  }

  function calcTax(price) {
    if (price <= 5000000) return <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ No Tax (below 5M RWF)</span>;
    const tax = (price - 5000000) * 0.025;
    return <span>Tax: <strong>{Math.round(tax).toLocaleString('en-US')} RWF</strong> (2.5%)</span>;
  }

  function PriceCard({ type, label, price, perSqm, taxNode }) {
    const fmtPrice = Math.round(price).toLocaleString('en-US') + ' RWF';
    const fmtPerSqm = parseFloat(perSqm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RWF/m²';
    const colors = {
      minimum: { top: '#ef4444', bg: '#f0fdf4', border: '#86efac', accent: '#16a34a' },
      average:  { top: '#0891b2', bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb' },
      maximum:  { top: '#f59e0b', bg: '#fef3c7', border: '#fcd34d', accent: '#d97706' },
    };
    const c = colors[type] || colors.average;
    return (
      <div style={{ background: c.bg, border: `2px solid ${c.border}`, borderRadius: 16, overflow: 'hidden', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 6, background: c.top, width: '100%' }} />
        <div style={{ padding: '20px 24px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: c.accent, marginBottom: 4, lineHeight: 1.2 }}>{fmtPrice}</div>
          <div style={{ fontSize: 12, color: '#4d7c77', marginBottom: 16, fontFamily: 'monospace' }}>{fmtPerSqm}</div>
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.7)', border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#374151', marginTop: 'auto' }}>{taxNode}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Map /> Land & Estimation by UPI</div>
        <div style={{ padding: '18px 20px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#4d7c77', display: 'flex' }}><Ic.Search /></span>
              <input className="f-inp" style={{ paddingLeft: 38 }} placeholder="e.g. xx/xx/xx/xx/xxxx" value={upi} onChange={e => setUpi(e.target.value)} required />
            </div>
            <button className="btn-p" type="submit" disabled={loading || predLoad}>
              {(loading || predLoad) ? <><Ic.Spin /> Searching…</> : <><Ic.Search /> Search & Estimate</>}
            </button>
          </form>
        </div>

        {data && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', marginBottom: 12 }}>Parcel: {data.UPI}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {Object.entries(data).filter(([k]) => k !== '_source').map(([k, v]) => (
                <div key={k} style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{k.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{String(v) || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {predLoad && <div style={{ padding: '24px', textAlign: 'center', color: '#4d7c77' }}><Ic.Spin /> &nbsp;Running AI estimation model…</div>}
        {predErr && <div style={{ margin: '0 20px 20px', background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>{predErr}</div>}

        {preds && !predLoad && (
          <div style={{ padding: '0 0 24px', width: '100%' }}>
            <button
              className="btn-p"
              style={{ margin: '0 20px 18px', justifyContent: 'center', width: 'calc(100% - 40px)' }}
              onClick={() => setShowPreds(v => !v)}
            >
              {showPreds ? 'Hide AI Price Estimation' : 'View AI Price Estimation'}
            </button>
            {showPreds && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '0 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase' }}>AI Price Estimation</div>
                  <div style={{ flex: 1, height: 1, background: '#ccf2ee' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, width: '100%' }}>
                  <PriceCard type="minimum" label="Minimum" price={preds.min_price} perSqm={preds.min_per_sqm} taxNode={calcTax(preds.min_price)} />
                  <PriceCard type="average"  label="Average"  price={preds.avg_price} perSqm={preds.avg_per_sqm} taxNode={calcTax(preds.avg_price)} />
                  <PriceCard type="maximum" label="Maximum" price={preds.max_price} perSqm={preds.max_per_sqm} taxNode={calcTax(preds.max_price)} />
                </div>
                <div style={{ margin: '14px 20px 0', padding: '10px 14px', background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, fontSize: 12, color: '#4d7c77', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  A 2.5% Capital Gains Tax applies only to the portion of the price above 5,000,000 RWF
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mutations View ───────────────────────────────────────────
function ViewMutations({ user, addAlert }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [permissionModal, setPermissionModal] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (d.success) setTxs(d.transactions || []);
      else addAlert(d.message, 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const statusColor = s => ({ 
    approved: '#0d9488', 
    pending: '#f59e0b', 
    rejected: '#ef4444', 
    permission_granted: '#10b981',
    forwarded_to_admin: '#7c3aed'
  }[s] || '#94a3b8');
  
  const statusLabel = s => ({ 
    approved: 'Approved', 
    pending: 'Pending Review', 
    rejected: 'Rejected',
    permission_granted: '✓ Permission Granted - Ready to Confirm',
    forwarded_to_admin: 'Forwarded to Admin (Awaiting Permission)'
  }[s] || s);

  // Step 1: District forwards to Admin and asks for permission
  async function forwardToAdmin(tx) {
    if (!confirm(`Forward mutation ${tx.reference} to Admin and request permission to confirm? Admin will review documents and grant permission if correct.`)) return;
    try {
      const r = await fetch(`${API}/admin/mutations/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction_id: tx.id, 
          forward_to_admin: true,
          request_permission: true,
          admin_notes: `District Officer ${user?.name} requests permission to confirm mutation. UPI: ${tx.upi}`,
          district_officer_id: user?.id,
          district_name: user?.district_name || ''
        })
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Mutation ${tx.reference} forwarded to Admin! Once Admin grants permission, you can confirm the transfer.`, 'success');
        load();
      } else addAlert(d.message || 'Forward failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  // Step 3: District confirms mutation after admin grants permission
  async function confirmMutation(tx) {
    if (!confirm(`Confirm mutation ${tx.reference}? Admin has granted permission. This will transfer ownership from ${tx.seller_name} to ${tx.buyer_name}.`)) return;
    setConfirmModal(null);
    try {
      const r = await fetch(`${API}/district/mutations/confirm`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ transaction_id: tx.id, district_id: user?.id })
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Mutation confirmed! Parcel transferred from ${tx.seller_name} to ${tx.buyer_name}`, 'success');
        load();
      } else addAlert(d.message || 'Confirmation failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }
  
  async function openDocs(t) {
    setDocsModal(t); setDocsData(null); setDocsLoading(true);
    try {
      const res = await fetch(`${API}/transaction/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: t.id }) });
      const data = await res.json();
      if (data.success) setDocsData(data);
      else addAlert(data.message || 'Failed to load documents', 'error');
    } catch { addAlert('Cannot load documents', 'error'); }
    setDocsLoading(false);
  }

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
              <button onClick={() => setConfirmModal(null)} className="x-close-btn">✕</button>
            </div>
            <div style={{ background: '#f0fdfa', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div><strong>UPI:</strong> {confirmModal.upi}</div>
              <div><strong>Seller:</strong> {confirmModal.seller_name}</div>
              <div><strong>Buyer:</strong> {confirmModal.buyer_name}</div>
              <div><strong>Price:</strong> {Number(confirmModal.agreed_price || 0).toLocaleString()} RWF</div>
              <div style={{ marginTop: 8, padding: 8, background: '#e8f5e9', borderRadius: 8 }}>
                <span style={{ color: '#10b981' }}>✓ Admin has granted permission</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-p" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', flex: 1 }} onClick={() => confirmMutation(confirmModal)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Confirm & Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {docsModal && (
        <div className="m-overlay" onClick={() => setDocsModal(null)}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Mutation Documents</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>{docsModal.reference} · {docsModal.upi}</div>
              </div>
              <button className="x-close-btn" onClick={() => setDocsModal(null)}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {docsLoading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, color: '#4d7c77' }}>Loading documents...</div>}
              {!docsLoading && docsData && (
                <>
                  {docsData.notary_info && (
                    <div style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>Notary Information</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{docsData.notary_info.notary_name}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
                    Documents ({docsData.total || 0})
                  </div>
                  {docsData.documents && docsData.documents.map((doc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: 12 }}>📄</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{doc.doc_type.replace(/_/g, ' ')}</div>
                        <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>{doc.original_name || doc.file_path}</div>
                      </div>
                      {doc.verified && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(22,163,74,.1)', color: '#16a34a' }}>✓ Verified</span>}
                      {doc.file_path && (
                        <a href={`https://land-price-api-35fr.onrender.com/uploads/${doc.file_path}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 7, background: 'rgba(8,145,178,.1)', color: '#0891b2', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          View
                        </a>
                      )}
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>All Mutations ({txs.length})</span>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading...</div>}
        {!loading && txs.length === 0 && <div className="empty-state">No mutations yet.</div>}
        {!loading && txs.length > 0 && (
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
                {txs.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 12 }}>{t.reference}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.upi}</td>
                    <td>{t.buyer_name}</td>
                    <td>{t.seller_name}</td>
                    <td style={{ fontWeight: 700 }}>{Number(t.agreed_price || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(t.status) }}>
                        ● {statusLabel(t.status)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#4d7c77' }}>{fmtDate(t.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', minWidth: 220 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                        {/* Step 1: Forward to Admin and request permission */}
                        {t.status === 'pending' && (
                          <button 
                            className="tbl-btn" 
                            style={{ background: 'rgba(124,58,237,.1)', color: '#7c3aed', fontSize: 10 }}
                            onClick={() => forwardToAdmin(t)}
                          >
                            Ask Permission
                          </button>
                        )}
                        
                        {/* Step 3: After Admin grants permission, District confirms */}
                        {t.status === 'permission_granted' && (
                          <button 
                            className="tbl-btn" 
                            style={{ background: 'rgba(13,148,136,.1)', color: '#0d9488' }}
                            onClick={() => setConfirmModal(t)}
                          >
                            ✓ Confirm Transfer
                          </button>
                        )}
                        
                        <button 
                          className="tbl-btn" 
                          style={{ background: 'rgba(8,145,178,.08)', color: '#0891b2', fontSize: 11 }} 
                          onClick={() => openDocs(t)}
                        >
                          Docs
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

// ── Reports Inbox (from Sector Officers) ─────────────────────
function ViewInbox({ user, addAlert }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [existingReport, setExistingReport] = useState(null);
  const [sentRefs, setSentRefs] = useState(new Set());
 
  async function loadInbox() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/district/inbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      const d = await r.json();
      if (d.success) setReports(d.reports || []);
      else setReports([]);
    } catch { setReports([]); }
    setLoading(false);
  }
 
  async function generateReport(e) {
    e.preventDefault();
    setGenResult(null);
    setExistingReport(null);
 
    if (!startDate || !endDate) {
      addAlert('Please select both start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      addAlert('Start date must be before end date', 'error');
      return;
    }
 
    setGenLoading(true);
    const body = { user_id: user?.id, start_date: startDate, end_date: endDate };
 
    try {
      const checkR = await fetch(`${API}/district/report/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const checkD = await checkR.json();
 
      if (checkD.success && checkD.exists) {
        setExistingReport(checkD.existing_report);
        addAlert(`Report already exists for this date range: ${checkD.existing_report.reference}`, 'warning');
        setGenLoading(false);
        return;
      }
 
      const r = await fetch(`${API}/district/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        setGenResult(d);
        addAlert(`Report generated: ${d.reference}`, 'success');
      } else addAlert(d.message || 'Generation failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setGenLoading(false);
  }
 
  async function forwardToAdmin(ref) {
    try {
      const r = await fetch(`${API}/district/report/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_ref: ref, user_id: user?.id })
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Report forwarded to Admin!`, 'success');
        setSentRefs(prev => new Set([...prev, ref]));
        if (genResult?.reference === ref) {
          setTimeout(() => {
            setGenResult(null);
            setStartDate('');
            setEndDate('');
          }, 2000);
        }
      } else addAlert(d.message || 'Forward failed', 'error');
    } catch { addAlert('Forward failed', 'error'); }
  }
 
  async function deleteReport(reportId) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/district/reports/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId })
      });
      const d = await r.json();
      if (d.success) { loadInbox(); addAlert('Report deleted.', 'success'); }
      else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Delete failed', 'error'); }
  }
 
  async function deleteAllReports() {
    setConfirmDeleteAll(false);
    try {
      const r = await fetch(`${API}/district/reports/delete-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      const d = await r.json();
      if (d.success) { loadInbox(); addAlert('All reports deleted.', 'success'); }
      else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Delete failed', 'error'); }
  }
 
  function downloadReport(report) {
    const blob = new Blob([
      `DISTRICT REPORT\n===============\nRef: ${report.reference}\n` +
      `From: ${report.from_name}\nSent: ${fmtDate(report.sent_at)}\n\n${report.content || '(No content)'}`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addAlert(`Downloaded ${report.reference}`, 'success');
  }
 
  function downloadGenerated() {
    if (!genResult) return;
    const blob = new Blob([
      `DISTRICT REPORT\n===============\nRef: ${genResult.reference}\n` +
      `Officer: ${user?.name}\nGenerated: ${new Date().toLocaleString('en-GB')}\n\n${genResult.content || ''}`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${genResult.reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
 
  useEffect(() => { loadInbox(); }, [user?.id]);
  const unread = reports.filter(r => !r.read).length;
 
  return (
    <div className="view">
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Report"
          message={`Delete report ${confirmDelete.reference}?`}
          detail={`From: ${confirmDelete.from_name}`}
          confirmText="Yes, Delete"
          confirmColor="#ef4444"
          onConfirm={() => deleteReport(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmDeleteAll && (
        <ConfirmDialog
          title="Delete All Reports"
          message={`Delete ALL ${reports.length} reports?`}
          detail="This action cannot be undone."
          confirmText="Yes, Delete All"
          confirmColor="#ef4444"
          onConfirm={deleteAllReports}
          onCancel={() => setConfirmDeleteAll(false)}
        />
      )}
 
      {/* Generate Report Card */}
      <div className="card">
        <div className="card-hd"><Ic.Report /> Generate District Report</div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{
            background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)',
            borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#0d9488',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Ic.Info />
            District reports include all parcels, sector officers, mutations, and pending items within the selected date range. Generated reports are forwarded to the System Admin.
          </div>
 
          {/* Date range only — no type selector */}
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
              All district activities (land parcels, officers, mutations, pending items) within this range will be included in a single comprehensive report.
            </div>
          </div>
 
          <button className="btn-p" onClick={generateReport} disabled={genLoading || !startDate || !endDate}
            style={{ width: '100%', justifyContent: 'center' }}>
            {genLoading ? <><Ic.Spin /> Generating…</> : <><Ic.Report /> Generate Full Report</>}
          </button>
        </div>
 
        {/* Existing report warning */}
        {existingReport && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{
              background: '#fef3c7', border: '1.5px solid #f59e0b',
              borderRadius: 12, padding: '14px 16px'
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 8 }}>
                Report already exists for this date range
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#b45309', marginBottom: 10 }}>
                {existingReport.reference} — generated {existingReport.generated_at
                  ? new Date(existingReport.generated_at).toLocaleString('en-GB') : ''}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-p" onClick={() => { setGenResult(existingReport); setExistingReport(null); }}>
                  View Existing
                </button>
                <button className="btn-p" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                  onClick={() => setExistingReport(null)}>
                  Generate New Anyway
                </button>
              </div>
            </div>
          </div>
        )}
 
        {/* Generated report preview */}
        {genResult && !existingReport && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: '#f0fdfa', border: '1px solid #ccf2ee', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase' }}>
                    Report Ready — {genResult.reference}
                  </div>
                  <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>
                    {startDate} → {endDate}
                  </div>
                </div>
                <button onClick={downloadGenerated}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #ccf2ee', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#4d7c77', fontFamily: 'inherit' }}>
                  <Ic.Download /> Save .txt
                </button>
              </div>
              {genResult.content && (
                <pre style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1e293b', margin: 0, maxHeight: 300, overflowY: 'auto' }}>
                  {genResult.content}
                </pre>
              )}
            </div>
            {sentRefs.has(genResult.reference) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(34,197,94,.1)', border: '1px solid #86efac', borderRadius: 'var(--rl)', color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                ✓ Forwarded to Admin
              </div>
            ) : (
              <button className="btn-p" style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
                onClick={() => forwardToAdmin(genResult.reference)}>
                <Ic.Send /> Forward to Admin
              </button>
            )}
          </div>
        )}
      </div>
 
      {/* Inbox from Sector Officers */}
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.Inbox /> Reports Inbox
            {unread > 0 && (
              <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
                {unread} new
              </span>
            )}
          </span>
          {reports.length > 0 && (
            <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)}>
              <Ic.Trash /> Delete All
            </button>
          )}
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading inbox…</div>}
        {!loading && reports.length === 0 && <div className="empty-state">No reports received yet.</div>}
      </div>
 
      {/* Report cards */}
      {!loading && reports.map(rpt => {
        const isExpanded = expanded === rpt.id;
        return (
          <div key={rpt.id} style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 14, padding: '16px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 13 }}>
                    {rpt.reference}
                  </span>
                  {!rpt.read && (
                    <span style={{ background: '#0d9488', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                      NEW
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {rpt.from_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{rpt.from_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(rpt.sent_at)}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setExpanded(isExpanded ? null : rpt.id)}
                  className="tbl-btn"
                  style={{ background: isExpanded ? 'rgba(13,148,136,.15)' : 'rgba(13,148,136,.08)', color: '#0d9488', padding: '6px 12px', gap: 5 }}>
                  {isExpanded ? '▲ Close' : '▼ View'}
                </button>
                <button onClick={() => downloadReport(rpt)}
                  className="tbl-btn"
                  style={{ background: 'rgba(59,130,246,.08)', color: '#2563eb', padding: '6px 10px' }}>
                  <Ic.Download />
                </button>
                {sentRefs.has(rpt.reference) ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', padding: '6px 10px' }}>✓ Sent</span>
                ) : (
                  <button onClick={() => forwardToAdmin(rpt.reference)}
                    className="tbl-btn"
                    style={{ background: 'rgba(124,58,237,.08)', color: '#7c3aed', padding: '6px 10px' }}>
                    <Ic.Send />
                  </button>
                )}
                <button onClick={() => setConfirmDelete(rpt)}
                  className="tbl-btn tbl-del"
                  style={{ padding: '6px 10px' }}>
                  <Ic.Trash />
                </button>
              </div>
            </div>
            {isExpanded && (
              <div style={{ marginTop: 4, animation: 'fadeUp .2s ease' }}>
                <div style={{ background: '#f9fefd', border: '1px solid #ccf2ee', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
                    Report Content
                  </div>
                  <pre style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#1e293b', margin: 0 }}>
                    {rpt.content || '(No content)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
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
      <div className="m-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, fontFamily: '"Times New Roman",Times,serif' }}>Change Password</div>
            <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>Update your account password</div>
          </div>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
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

// ── ROOT ─────────────────────────────────────────────────────
export default function DistrictDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState({ officers: 0, parcels: 0, mutations: 0, reports: 0 });
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`lpes_photo_district_${user.id}`);
      if (saved) setProfilePhoto(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    function fn(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); }
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API}/district/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) })
      .then(r => r.json()).then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {});
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
      localStorage.setItem(`lpes_photo_district_${user.id}`, data);
      addAlert('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  const initials = user?.name?.split(' ').filter(Boolean).slice(0,2).map(n => n[0]?.toUpperCase()).join('') || 'DO';

  const TITLES = {
    dashboard: 'Overview', sector: 'Sector Officers', land_parcels: 'Land Parcels',
    landdata: 'Land Data', mutations: 'Mutations', inbox: 'Reports Inbox',
  };

  function renderContent() {
    switch (active) {
      case 'dashboard': return <ViewDashboard setActive={setActive} stats={stats} />;
      // FIXED: pass user prop so ViewSector can call /district/officers with user_id
      case 'sector':       return <ViewSector user={user} addAlert={addAlert} />;
      case 'land_parcels': return <ViewLandParcels user={user} addAlert={addAlert} />;
      case 'landdata':  return <ViewLandData addAlert={addAlert} />;
      case 'mutations': return <ViewMutations addAlert={addAlert} />;
      case 'inbox':     return <ViewInbox user={user} addAlert={addAlert} />;
      default:          return <ViewDashboard setActive={setActive} stats={stats} />;
    }
  }

  return (
    <>
      <Head>
        <title>{TITLES[active]} — District · LPES</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>
      <ToastContainer alerts={alerts} removeAlert={removeAlert} />
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      {showChangePw && <ChangePasswordModal user={user} addAlert={addAlert} onClose={() => setShowChangePw(false)} />}
      
      {logoutConfirm && (
        <div className="m-overlay" onClick={() => setLogoutConfirm(false)}>
          <div className="m-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center', padding: '32px 28px', position: 'relative' }}>
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
        .topbar-user-wrap{position:relative;padding:0 16px;flex-shrink:0;} .topbar-user{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:6px;background:white;border:1px solid #d1d5db;cursor:pointer;user-select:none;transition:background .18s;color:#1f2937;} .topbar-user:hover{background:#f9fafb}
        .topbar-user-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800;flex-shrink:0;}
        .topbar-user-name{font-size:13px;font-weight:600;color:#1f2937;font-family:"Times New Roman",Times,serif;} .topbar-sep{color:#9ca3af;font-size:13px;margin:0 2px} .topbar-role{color:#6b7280;font-size:13px;font-family:"Times New Roman",Times,serif} .topbar-chev{color:#6b7280;display:flex;align-items:center;margin-left:4px}
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
        .stat-card{background:white;border:1px solid var(--g200);border-radius:var(--rxl);padding:18px;box-shadow:var(--sh-sm)} .stat-card.clickable:hover{transform:translateY(-2px);box-shadow:var(--sh-md);border-color:var(--teal);cursor:pointer} .stat-value{font-size:30px;font-weight:800;color:#0c1a19} .stat-label{font-size:13px;font-weight:600;margin-top:4px} .stat-sub{font-size:11px;color:#4d7c77;margin-top:2px}
        .section-label{font-size:11px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
        .qa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .qa-card{background:white;border:1.5px solid var(--g200);border-radius:var(--rxl);padding:18px;cursor:pointer;text-align:left;transition:all .2s;font-family:"Times New Roman",Times,serif} .qa-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-md)}
        .qa-dot{width:10px;height:10px;border-radius:50%;margin-bottom:8px} .qa-label{font-size:14px;font-weight:700} .qa-desc{font-size:12px;color:#4d7c77;margin-top:4px}
        .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:hidden;animation:fadeUp .4s ease}
        .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:14px 20px;font-family:"Times New Roman",Times,serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:var(--rxl) var(--rxl) 0 0}
        .data-table{width:100%;border-collapse:collapse} .data-table th{text-align:left;padding:10px 16px;font-size:11px;font-weight:700;color:#4d7c77;background:#f9fefd;border-bottom:1px solid #ccf2ee;white-space:nowrap} .data-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0fdfa;vertical-align:middle} .data-table tr:last-child td{border-bottom:none} .data-table tbody tr:hover{background:#f9fefd}
        .btn-p{display:flex;align-items:center;gap:7px;padding:10px 18px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap} .btn-p:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--sh-md)} .btn-p:disabled{opacity:.7;cursor:not-allowed}
        .btn-danger{display:flex;align-items:center;gap:7px;padding:8px 16px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap}
        .btn-danger:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(239,68,68,.3)}
        .btn-ghost{background:#f9fefd;border:1.5px solid var(--g200);padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;color:#4d7c77;font-family:inherit;transition:all .15s} .btn-ghost:hover{border-color:var(--teal);color:var(--teal)}
        .btn-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#f9fefd;border:1.5px solid var(--g200);border-radius:10px;cursor:pointer;color:#4d7c77;transition:all .15s} .btn-icon:hover{border-color:var(--teal);color:var(--teal)}
        .tbl-btn{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;font-family:inherit;transition:all .15s}
        .tbl-del{background:rgba(239,68,68,.08);color:#ef4444} .tbl-del:hover{background:rgba(239,68,68,.15)} .tbl-approve{background:rgba(34,197,94,.1);color:#16a34a} .tbl-approve:hover{background:rgba(34,197,94,.2)} .tbl-edit{background:rgba(13,148,136,.1);color:#0d9488} .tbl-edit:hover{background:rgba(13,148,136,.2)} .tbl-edit{background:rgba(13,148,136,.1);color:#0d9488} .tbl-edit:hover{background:rgba(13,148,136,.2)} .tbl-edit{background:rgba(13,148,136,.1);color:#0d9488} .tbl-edit:hover{background:rgba(13,148,136,.2)} .tbl-edit{background:rgba(13,148,136,.1);color:#0d9488} .tbl-edit:hover{background:rgba(13,148,136,.2)} .tbl-edit{background:rgba(13,148,136,.1);color:#0d9488} .tbl-edit:hover{background:rgba(13,148,136,.2)}
        .officer-card{display:flex;align-items:center;gap:14px;background:var(--teal-l);border:1px solid var(--g200);border-radius:12px;padding:12px 16px;margin-bottom:8px;transition:all .15s} .officer-card:hover{border-color:var(--teal)} .pending-card{background:#fffbeb;border-color:#fde68a}
        .oc-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px;flex-shrink:0}
        .loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#4d7c77;font-size:14px} .empty-state{padding:40px;text-align:center;color:#4d7c77;font-size:14px}
        .m-overlay{position:fixed;inset:0;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
        .m-box{background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);width:100%;max-width:420px;padding:26px;position:relative;animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both}
        .modal-close{background:#f9fefd;border:1px solid var(--g200);border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#4d7c77;transition:color .15s,background .15s,border-color .15s} .modal-close:hover{background:rgba(239,68,68,.08);color:#ef4444;border-color:#fca5a5}
        .x-close-btn{background:none;border:none;cursor:pointer;color:#6b7280;display:flex;align-items:center;padding:6px;border-radius:6px;transition:color .15s,background .15s}
        .x-close-btn:hover{color:#ef4444;background:rgba(239,68,68,.1)}
        .lp-search::placeholder{color:rgba(255,255,255,.75);}
        .f-inp{padding:10px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%} .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white}
        .confirm-box{background:white;border-radius:20px;width:100%;max-width:420px;padding:32px 28px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:10px;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:mIn .2s ease}
        .confirm-icon{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px} .confirm-title{font-size:18px;font-weight:800;font-family:"Times New Roman",Times,serif} .confirm-msg{font-size:14px;color:#374151;line-height:1.5}
        .confirm-detail{font-size:12px;color:#4d7c77;background:#f9fefd;border:1px solid var(--g200);border-radius:8px;padding:10px 14px;width:100%;text-align:left;font-style:italic}
        .confirm-actions{display:flex;gap:10px;width:100%;margin-top:4px} .confirm-actions .btn-ghost{flex:1;text-align:center}
        .logout-btn{transition:background .2s,transform .15s} .logout-btn:hover{background:#dc2626 !important;transform:translateY(-1px)}
        @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}.qa-grid{grid-template-columns:1fr 1fr}}
      `}</style>

      <div className="shell">
        <div className="topbar">
          <div className="topbar-brand"><div className="topbar-brand-acronym">L P E S</div><div className="topbar-brand-tagline">Land Price Estimation System</div></div>
          <div className="topbar-expand-wrap"><button className="topbar-expand-btn" onClick={() => setSidebarOpen(o => !o)}><Ic.Menu /></button></div>
          <div className="topbar-title">A Machine Learning-Based Framework for Land Price Estimation</div>
          <div className="topbar-user-wrap" ref={userMenuRef} style={{ paddingRight: 16, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div className="topbar-user" onClick={() => setUserMenuOpen(o => !o)}>
              <div className="topbar-user-avatar">
                {profilePhoto
                ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials}
              </div>
              <span className="topbar-user-name">{user?.name}</span>
              <span className="topbar-sep">|</span>
              <span className="topbar-role">District: {user?.district_name || 'Not Assigned'}</span>
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
                  <div className="ud-role">District Officer</div>
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
          <div className="main"><div className="content">{renderContent()}</div></div>
        </div>
      </div>
    </>
  );
}