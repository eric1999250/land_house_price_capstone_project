// pages/dashboard/admin.js
// FULLY RESPONSIVE ADMIN DASHBOARD - Works on Desktop, Tablet, Mobile

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
    <div className="toast-container">
      {alerts.map(a => (
        <div key={a.id} className={`toast toast-${a.type}`}>
          <span className="toast-icon">{a.type === 'success' ? '✓' : a.type === 'error' ? '✕' : '!'}</span>
          <span className="toast-message">{a.message}</span>
          <button onClick={() => removeAlert(a.id)} className="toast-close">×</button>
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ title, message, detail, confirmText, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-confirm">
        <div className="modal-confirm-header">
          <div className="modal-confirm-title">{title}</div>
          <button onClick={onCancel} className="modal-close-btn">×</button>
        </div>
        <div className="modal-confirm-message">{message}</div>
        {detail && <div className="modal-confirm-detail">{detail}</div>}
        <div className="modal-confirm-actions">
          <button style={{ background: confirmColor }} onClick={onConfirm} className="modal-confirm-btn">Yes, {confirmText}</button>
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
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  District: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/></svg>,
  Notary: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  MapPin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Monitor: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Report: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>,
  Predict: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>,
  X: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Spin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin .7s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Add: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Search: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Menu: () => <svg width="22" height="18" viewBox="0 0 22 18" fill="none"><path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5"/><rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor"/><rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor"/><rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor"/><rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor"/></svg>,
  ChevDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>,
  Refresh: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
  Save: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Suggestions: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/></svg>,
  Info: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  TrendUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
};

// ── NAVIGATION ──
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'land_parcels', label: 'Land Parcels', icon: 'MapPin' },
  { id: 'users', label: 'All Users', icon: 'Users' },
  { id: 'district', label: 'District Officers', icon: 'District' },
  { id: 'private_notaries', label: 'Private Notaries', icon: 'Notary' },
  { id: 'locations', label: 'Locations', icon: 'MapPin' },
  { id: 'stamped_records', label: 'Stamped Records', icon: 'Notary' },
  { id: 'transactions', label: 'Mutations', icon: 'Monitor' },
  { id: 'price_trends', label: 'Price Trends', icon: 'TrendUp' },
  { id: 'predict', label: 'Land & Estimation', icon: 'Predict' },
  { id: 'suggestions', label: 'Suggestions', icon: 'Suggestions' },
  { id: 'reports', label: 'Reports Inbox', icon: 'Report' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

function Sidebar({ active, setActive, sidebarOpen, suggestionBadge, reportBadge, mutationBadge }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <div className="sidebar-backdrop" onClick={() => setActive(null)}></div>
      <nav className="sidebar-nav">
        <div className="sidebar-section">Navigation</div>
        {NAV.map(n => {
          const IconComp = Ic[n.icon];
          const hasBadge = (n.id === 'suggestions' && suggestionBadge) || 
                 (n.id === 'reports' && reportBadge) ||
                 (n.id === 'transactions' && mutationBadge);
          return (
            <button key={n.id} className={`sidebar-item ${active === n.id ? 'active' : ''} ${hasBadge ? 'has-badge' : ''}`} onClick={() => setActive(n.id)}>
              <span className="sidebar-icon">
                {IconComp && <IconComp />}
                {hasBadge && <span className="sidebar-badge-dot"></span>}
              </span>
              <span className="sidebar-label">{n.label}</span>
              {active === n.id && <span className="sidebar-active-pip"></span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Add Person Modal ──
function AddPersonModal({ role, notaryType, onConfirm, onCancel, addAlert }) {
  const label = role === 'district_land_officer' ? 'District Officer' : 'Private Notary';
  const [form, setForm] = useState({ 
    full_name: '', email: '', password: '', phone: '', 
    license_number: '', province_id: '', district_id: '', sector_id: '',
    district_name: '', sector_name: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);

  useEffect(() => {
    fetch(`${API}/locations/provinces`)
      .then(r => r.json())
      .then(d => { if (d.success) setProvinces(d.provinces || []); })
      .catch(err => console.error('Failed to load provinces:', err));
  }, []);

  useEffect(() => {
    if (!form.province_id) { setDistricts([]); return; }
    setLoadingDistricts(true);
    fetch(`${API}/locations/districts/by-province`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ province_id: parseInt(form.province_id) })
    })
      .then(r => r.json())
      .then(d => { if (d.success) setDistricts(d.districts || []); else setDistricts([]); })
      .catch(err => setDistricts([]))
      .finally(() => setLoadingDistricts(false));
  }, [form.province_id]);

  useEffect(() => {
    if (!form.district_id) { setSectors([]); return; }
    setLoadingSectors(true);
    fetch(`${API}/locations/sectors/by-district`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district_id: parseInt(form.district_id) })
    })
      .then(r => r.json())
      .then(d => { if (d.success) setSectors(d.sectors || []); else setSectors([]); })
      .catch(err => setSectors([]))
      .finally(() => setLoadingSectors(false));
  }, [form.district_id]);

  const h = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === 'email') setErrors(ev => ({ ...ev, email: validateEmail(value) ? '' : 'Use Gmail, Yahoo, Outlook, or a .rw email.' }));
    if (name === 'phone') { const r = validatePhone(value); setErrors(ev => ({ ...ev, phone: r.ok ? '' : r.msg })); }
    if (name === 'password') { const r = validatePassword(value, form.full_name, form.email); setErrors(ev => ({ ...ev, password: r.ok ? '' : r.msg })); }
    if (name === 'province_id') setForm(f => ({ ...f, province_id: value, district_id: '', district_name: '', sector_id: '', sector_name: '' }));
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
    const pwRes = validatePassword(form.password, form.full_name, form.email);
    const newErrs = { email: emailErr, phone: phoneRes.ok ? '' : phoneRes.msg, password: pwRes.ok ? '' : pwRes.msg };
    
    if (role === 'district_land_officer' && !form.district_id) newErrs.district = 'Please select a district';
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
      
      if (role === 'district_land_officer') {
        payload.district_id = parseInt(form.district_id);
        payload.district_name = form.district_name;
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
      addAlert('Cannot connect', 'error'); 
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <div className="modal-title">Add {label}</div>
            <div className="modal-subtitle">Register and auto-approve</div>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={submit} className="form-vertical">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" name="full_name" value={form.full_name} onChange={h} placeholder="Full Name" required />
            </div>
            
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" name="email" value={form.email} onChange={h} placeholder="officer@example.rw" type="email" required />
              {errors.email && <div className="form-error">{errors.email}</div>}
              {!errors.email && form.email && validateEmail(form.email) && <div className="form-success">✓ Valid email</div>}
            </div>
            
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" name="password" value={form.password} onChange={h} placeholder="Min 8 chars" type="password" required />
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+250</span>
                <input className="phone-input" name="phone" type="text" inputMode="numeric" placeholder="7XXXXXXXXX" value={form.phone} maxLength={9} onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setForm(f => ({ ...f, phone: digits }));
                }} />
              </div>
              {errors.phone && <div className="form-error">{errors.phone}</div>}
            </div>

            {role === 'notary' && notaryType === 'private' && (
              <div className="form-group">
                <label className="form-label">License Number *</label>
                <input className="form-input" name="license_number" value={form.license_number} onChange={h} placeholder="NTR-2024-001" />
              </div>
            )}

            {role === 'district_land_officer' && (
              <>
                <div className="form-group">
                  <label className="form-label">Province *</label>
                  <select className="form-select" name="province_id" value={form.province_id} onChange={h} required>
                    <option value="">— Select Province —</option>
                    {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">District *</label>
                  <select className="form-select" name="district_id" value={form.district_id} onChange={h} required disabled={!form.province_id || loadingDistricts}>
                    <option value="">— Select District —</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.district && <div className="form-error">{errors.district}</div>}
                </div>
              </>
            )}

            {role === 'notary' && notaryType === 'private' && (
              <>
                <div className="form-group">
                  <label className="form-label">Province *</label>
                  <select className="form-select" name="province_id" value={form.province_id} onChange={h} required>
                    <option value="">— Select Province —</option>
                    {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">District *</label>
                  <select className="form-select" name="district_id" value={form.district_id} onChange={h} required disabled={!form.province_id || loadingDistricts}>
                    <option value="">— Select District —</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.district && <div className="form-error">{errors.district}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Sector *</label>
                  <select className="form-select" name="sector_id" value={form.sector_id} onChange={h} required disabled={!form.district_id || loadingSectors}>
                    <option value="">— Select Sector —</option>
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {errors.sector && <div className="form-error">{errors.sector}</div>}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn-primary" type="submit" disabled={loading}>
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
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit User</div>
            <div className="modal-subtitle">{u.email}</div>
          </div>
          <button className="modal-close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          {[['full_name','Full Name'],['email','Email'],['phone','Phone']].map(([n,l]) => (
            <div className="form-group" key={n}>
              <label className="form-label">{l}</label>
              <input className="form-input" value={form[n]} onChange={e => setForm(f => ({ ...f, [n]: e.target.value }))} required={n !== 'phone'} />
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn-primary" onClick={submit} disabled={loading}>
              {loading ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard View ──
function ViewDashboard({ setActive, stats }) {
  return (
    <div className="view">
      <div className="stats-grid">
        <div className="stat-card clickable" onClick={() => setActive('users')}>
          <div className="stat-value">{stats.total ?? 0}</div>
          <div className="stat-label">Total Users</div>
          <div className="stat-sub">registered accounts</div>
        </div>
        <div className="stat-card clickable" onClick={() => setActive('district')}>
          <div className="stat-value">{stats.district ?? 0}</div>
          <div className="stat-label">District Officers</div>
          <div className="stat-sub">active officers</div>
        </div>
        <div className="stat-card clickable" onClick={() => setActive('private_notaries')}>
          <div className="stat-value">{stats.notary_private ?? 0}</div>
          <div className="stat-label">Private Notaries</div>
          <div className="stat-sub">private notaries</div>
        </div>
        <div className="stat-card clickable" onClick={() => setActive('transactions')}>
          <div className="stat-value">{stats.txs ?? 0}</div>
          <div className="stat-label">Mutations</div>
          <div className="stat-sub">transactions</div>
        </div>
        <div className="stat-card clickable" onClick={() => setActive('stamped_records')}>
          <div className="stat-value">{stats.stamped_records ?? 0}</div>
          <div className="stat-label">Stamped Records</div>
          <div className="stat-sub">stamped documents</div>
        </div>
      </div>
      
      <div className="section-label">QUICK ACTIONS</div>
      <div className="qa-grid">
        {[
          { label: 'Manage Users', desc: 'View, edit, delete all system users', id: 'users', color: '#0d9488' },
          { label: 'District Officers', desc: 'Add & manage district officers', id: 'district', color: '#0891b2' },
          { label: 'Private Notaries', desc: 'Add & manage private notaries', id: 'private_notaries', color: '#a855f7' },
          { label: 'Mutations', desc: 'View all system mutation records', id: 'transactions', color: '#f59e0b' },
          { label: 'Stamped Records', desc: 'View, edit & delete notary stamped data', id: 'stamped_records', color: '#6366f1' },
          { label: 'Land & Estimation', desc: 'Search parcels & estimate land prices', id: 'predict', color: '#10b981' },
          { label: 'Reports Inbox', desc: 'Reports forwarded from district', id: 'reports', color: '#7c3aed' },
          { label: 'Suggestions', desc: 'Read feedback from buyers & sellers', id: 'suggestions', color: '#22c55e' },
          { label: 'Land Parcels', desc: 'Register & manage UPIs for users', id: 'land_parcels', color: '#0891b2' },
          { label: 'Settings', desc: 'Configure system parameters', id: 'settings', color: '#e11d48' },
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

// ── All Users View ──
function ViewUsers({ addAlert }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [activeRole, setActiveRole] = useState('all');

  const ROLES = [
    { id: 'all', label: 'All Users' },
    { id: 'district_land_officer', label: 'District Officers'},
    { id: 'notary_sector', label: 'Sector Notaries' },
    { id: 'notary_private', label: 'Private Notaries' },
    { id: 'buyer_seller', label: 'Buyers/Sellers' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
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

  useEffect(() => { load(); const unsub = eventBus.on('userChanged', () => load()); return () => unsub(); }, [load]);

  const roleLabel = r => ({ system_admin:'Admin', admin:'Admin', district_land_officer:'District Officer', sector_land_officer:'Sector Officer', notary:'Notary', buyer_seller:'Buyer/Seller' }[r] || r);
  const statusColor = s => ({ approved:'#0d9488', pending:'#f59e0b', suspended:'#ef4444' }[s] || '#94a3b8');
  const roleColor = r => ({ district_land_officer:'#0891b2', sector_land_officer:'#22c55e', notary:'#8b5cf6', buyer_seller:'#f59e0b', system_admin:'#0d9488', admin:'#0d9488' }[r] || '#64748b');

  const filtered = users.filter(u => {
    if (u.role === 'system_admin' || u.role === 'admin') return false;
    if (activeRole === 'notary_sector' && !(u.role === 'notary' && u.notary_type === 'sector')) return false;
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
        <div className="card-header">
          <span className="card-header-title"><Ic.Users /> System Users ({filtered.length})</span>
          <div className="search-wrapper">
            <Ic.Search />
            <input className="search-input" placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        
        <div className="role-tabs">
          {ROLES.map(role => (
            <button key={role.id} className={`role-tab ${activeRole === role.id ? 'active' : ''}`} onClick={() => setActiveRole(role.id)}>
              {role.label}
              <span className="tab-count">
                {role.id === 'all' ? users.filter(u => u.role !== 'system_admin' && u.role !== 'admin').length
                  : role.id === 'notary_sector' ? users.filter(u => u.role === 'notary' && u.notary_type === 'sector').length
                  : role.id === 'notary_private' ? users.filter(u => u.role === 'notary' && u.notary_type === 'private').length
                  : users.filter(u => u.role === role.id).length}
              </span>
            </button>
          ))}
        </div>
        
        {loading && <div className="loading-state"><Ic.Spin /> Loading users…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No users found{search ? ' matching your search' : ''}.</div>}
        {!loading && filtered.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td><div className="user-cell"><div className="user-avatar" style={{ background: `linear-gradient(135deg,${roleColor(u.role)},${roleColor(u.role)}99)` }}>{u.full_name?.[0]?.toUpperCase()}</div><strong>{u.full_name}</strong></div></td>
                    <td className="mono-text">{u.email}</td>
                    <td><span className="role-chip" style={{ background: `${roleColor(u.role)}18`, color: roleColor(u.role) }}>{roleLabel(u.role)}{u.role === 'notary' && u.notary_type ? ` (${u.notary_type})` : ''}</span></td>
                    <td><span style={{ color: statusColor(u.status), fontWeight: 700 }}>● {u.status}</span></td>
                    <td className="date-text">{fmtDate(u.created_at)}</td>
                    <td><div className="action-buttons"><button className="btn-edit" onClick={() => setEditModal(u)}><Ic.Edit /> Edit</button><button className="btn-delete" onClick={() => setConfirmDelete(u)}><Ic.Trash /></button></div></td>
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

// ── Role Management View ──
function ViewRoleManagement({ role, notaryType, accentColor, addAlert }) {
  const isNotary = role === 'notary';
  const label = role === 'district_land_officer' ? 'District Officer' : notaryType === 'sector' ? 'Sector Notary' : 'Private Notary';
  const labelPlural = role === 'district_land_officer' ? 'District Officers' : notaryType === 'sector' ? 'Sector Notaries' : 'Private Notaries';

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = { role };
      if (isNotary && notaryType) body.notary_type = notaryType;
      const r = await fetch(`${API}/admin/users/by-role`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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

  useEffect(() => { load(); const unsub = eventBus.on('userChanged', (data) => { if (!data.role || data.role === role) load(); }); return () => unsub(); }, [load, role]);

  const pending = people.filter(p => p.status === 'pending');
  const approved = people.filter(p => p.status === 'approved');

  return (
    <div className="view">
      {showAdd && <AddPersonModal role={role} notaryType={notaryType} addAlert={addAlert} onConfirm={() => { setShowAdd(false); load(); }} onCancel={() => setShowAdd(false)} />}
      {confirmDelete && <ConfirmDialog title={`Remove ${label}`} message={`Remove ${confirmDelete.full_name}?`} confirmText="Yes, Remove" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}

      <div className="info-banner" style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}>
        <div className="info-banner-icon">{notaryType === 'sector' ? '🏛️' : '⚖️'}</div>
        <div>
          <div className="info-banner-title">{labelPlural}</div>
          <div className="info-banner-desc">
            {notaryType === 'sector'
              ? 'Sector Notaries are government-employed notaries at the sector level. They can certify land mutation deeds for transactions in their sector.'
              : 'Private Notaries are independent legal professionals who certify land mutation deeds. Adding them here registers and auto-approves them.'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}bb)` }}>
          <span className="card-header-title"><Ic.Notary /> {labelPlural} ({people.length})</span>
          <button className="btn-primary-outline" onClick={() => setShowAdd(true)}><Ic.Add /> Add {label}</button>
        </div>
        
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        
        {!loading && pending.length > 0 && (
          <div className="section-pending">
            <div className="section-title pending-title">⏳ Pending Approval ({pending.length})</div>
            {pending.map(p => (
              <div key={p.id} className="officer-card pending-card">
                <div className="officer-avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>{p.full_name?.[0]}</div>
                <div className="officer-info">
                  <div className="officer-name">{p.full_name}</div>
                  <div className="officer-details">{p.email}{p.district_name ? ` · ${p.district_name}` : ''}{p.sector_name ? ` · ${p.sector_name}` : ''} · Joined {fmtDate(p.created_at)}</div>
                </div>
                <button className="btn-approve" onClick={() => approve(p)}><Ic.Check /> Approve</button>
              </div>
            ))}
          </div>
        )}
        
        {!loading && approved.length > 0 && (
          <div className="section-approved">
            <div className="section-title" style={{ color: accentColor }}>✓ Active {labelPlural} ({approved.length})</div>
            {approved.map(p => (
              <div key={p.id} className="officer-card" style={{ borderLeftColor: accentColor }}>
                <div className="officer-avatar" style={{ background: `linear-gradient(135deg,${accentColor},${accentColor}99)` }}>{p.full_name?.[0]}</div>
                <div className="officer-info">
                  <div className="officer-name">{p.full_name}</div>
                  <div className="officer-details">{p.email}{p.district_name ? ` · District: ${p.district_name}` : ''}{p.sector_name ? ` · Sector: ${p.sector_name}` : ''}{p.license_number ? ` · License: ${p.license_number}` : ''} · Joined {fmtDate(p.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && people.length === 0 && (
          <div className="empty-state">No {labelPlural.toLowerCase()} yet.<br />
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Add First {label}</button>
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

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.upi?.toLowerCase().includes(q) || r.seller_name?.toLowerCase().includes(q) || r.buyer_name?.toLowerCase().includes(q) || r.cert_number?.toLowerCase().includes(q);
  });

  const fmt = v => v ? Number(v).toLocaleString() : '—';

  return (
    <div className="view">
      {confirmDelete && <ConfirmDialog title="Delete Stamped Record" message={`Delete record for UPI: ${confirmDelete.upi}?`} detail={`Buyer: ${confirmDelete.buyer_name} ↔ Seller: ${confirmDelete.seller_name}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
      
      <div className="card">
        <div className="card-header" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          <span className="card-header-title"><Ic.Notary /> Stamped Parcel Records ({filtered.length})</span>
          <div className="search-wrapper"><Ic.Search /><input className="search-input" placeholder="Search UPI, buyer, seller…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        
        {loading && <div className="loading-state"><Ic.Spin /> Loading records…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No stamped records found{search ? ' matching your search' : ''}.</div>}
        {!loading && filtered.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>UPI</th><th>Cert #</th><th>Buyer</th><th>Seller</th><th>Agreed Price</th><th>ML Min</th><th>ML Avg</th><th>ML Max</th><th>Tax</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <tr key={rec.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}>
                    <td className="mono-text" style={{ color: '#6366f1', fontWeight: 700 }}>{rec.upi}</td>
                    <td className="mono-text">{rec.cert_number || '—'}</td>
                    <td>{rec.buyer_name}</td>
                    <td>{rec.seller_name}</td>
                    <td className="price-text">{fmt(rec.agreed_price)} RWF</td>
                    <td className="price-min">{fmt(rec.ml_min_price)} RWF</td>
                    <td className="price-avg">{fmt(rec.ml_avg_price)} RWF</td>
                    <td className="price-max">{fmt(rec.ml_max_price)} RWF</td>
                    <td className={rec.capital_gains_tax > 0 ? 'price-negative' : 'price-positive'}>{rec.capital_gains_tax > 0 ? fmt(rec.capital_gains_tax) + ' RWF' : 'No Tax'}</td>
                    <td className="date-text">{fmtDate(rec.stamped_at)}</td>
                    <td><div className="action-buttons" onClick={e => e.stopPropagation()}><button className="btn-edit" onClick={() => setEditModal(rec)}><Ic.Edit /> Edit</button><button className="btn-delete" onClick={() => setConfirmDelete(rec)}><Ic.Trash /></button></div></td>
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

// ── Land Parcels View ──
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
    province:'', district:'', sector:'', cell:'', village:'', x:'', y:'', area_m2:'', land_use:'',
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
      if (uData.success) setUsers((uData.users || []).filter(u => u.role === 'buyer_seller'));
    } catch { addAlert('Cannot connect', 'error'); }
    setLoading(false);
  }, [addAlert]);

  useEffect(() => { load(); }, [load]);

  const h = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

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
          setForm(f => ({ ...f, upi: val, province: p.Province !== 'N/A' ? p.Province : f.province, district: p.District !== 'N/A' ? p.District : f.district, sector: p.Sector !== 'N/A' ? p.Sector : f.sector, cell: (p.Cell && p.Cell !== 'N/A' && p.Cell !== 'nan') ? p.Cell : f.cell, village: (p.Village && p.Village !== 'N/A' && p.Village !== 'nan') ? p.Village : f.village, x: p.X_coordinate || f.x, y: p.Y_coordinate || f.y, area_m2: p.Area || f.area_m2, land_use: p.Land_use !== 'N/A' ? p.Land_use : f.land_use, zoning: p.Zoning !== 'N/A' ? p.Zoning : f.zoning, zoning_percentage: p['Zoning_%'] || f.zoning_percentage, sentlement: p.Settlement !== 'N/A' ? p.Settlement : f.sentlement, sentlement_percentage: p['Settlement_%'] ?? f.sentlement_percentage, minimum_value_per_sqm: p.Min_Value_Sqm || f.minimum_value_per_sqm, weighted_average_value_per_sqm: p.Avg_Value_Sqm || f.weighted_average_value_per_sqm, maximum_value_per_sqm: p.Max_Value_Sqm || f.maximum_value_per_sqm }));
          setUpiAutoFilled(true);
        }
      } catch { }
    }
  }

  async function saveParcel(isEdit = false) {
    if (!form.upi.trim()) { addAlert('UPI is required', 'error'); return; }
    if (!form.user_id) { addAlert('Please assign to a user', 'error'); return; }
    if (!form.area_m2) { addAlert('Area is required', 'error'); return; }
    if (!form.land_use.trim()) { addAlert('Land use is required', 'error'); return; }
    setSaving(true);
    try {
      const url = isEdit ? `${API}/admin/land-parcels/edit` : `${API}/admin/land-parcels/create`;
      const body = isEdit ? { parcel_id: editModal.id, ...form } : { ...form };
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) {
        addAlert(isEdit ? 'Parcel updated!' : 'Parcel registered!', 'success');
        setShowAdd(false); setEditModal(null);
        setForm({ ...emptyForm }); setUpiAutoFilled(false);
        load();
      } else addAlert(d.message || 'Failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setSaving(false);
  }

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

  return (
    <div className="view">
      {(showAdd || editModal) && (
        <div className="modal-overlay">
          <div className="modal-container modal-large">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editModal ? 'Edit Parcel' : 'Register New UPI'}</div>
                <div className="modal-subtitle">{editModal ? `UPI: ${editModal?.upi}` : 'Assign land parcel to a user'}</div>
              </div>
              <button className="modal-close-btn" onClick={() => { setShowAdd(false); setEditModal(null); setForm({...emptyForm}); setUpiAutoFilled(false); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-vertical">
                <div className="form-group">
                  <label className="form-label">UPI *</label>
                  <input className="form-input" name="upi" value={form.upi} onChange={handleUpiChange} placeholder="e.g. 2/04/07/02/669" style={{ fontFamily: 'monospace' }} />
                  {upiAutoFilled && <div className="form-success">✓ Location data auto-filled from CSV</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Assign to User *</label>
                  <div className="user-search-wrapper">
                    <input className="form-input" placeholder="Search user by name or email…" value={selectedUser ? `${selectedUser.full_name} (${selectedUser.email})` : userSearch}
                      onChange={e => { setUserSearch(e.target.value); setShowUserDrop(true); setForm(f => ({ ...f, user_id: '' })); }}
                      onFocus={() => setShowUserDrop(true)} />
                    {showUserDrop && !form.user_id && filteredUsers.length > 0 && (
                      <div className="user-dropdown-list">
                        {filteredUsers.map(u => (<div key={u.id} className="user-dropdown-item" onClick={() => { setForm(f => ({ ...f, user_id: u.id, owner_name: u.full_name || f.owner_name, owner_national_id: u.national_id || '' })); setUserSearch(''); setShowUserDrop(false); }}><strong>{u.full_name}</strong><span className="user-email">{u.email}</span></div>))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Owner Full Name</label>
                    <input className="form-input" name="owner_name" value={form.owner_name} onChange={h} placeholder="Full legal name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner National ID</label>
                    <input className="form-input" name="owner_national_id" value={form.owner_national_id} onChange={h} placeholder="16-digit ID" maxLength={16} style={{ fontFamily: 'monospace' }} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Province</label>
                    <input className="form-input" name="province" value={form.province} onChange={h} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">District</label>
                    <input className="form-input" name="district" value={form.district} onChange={h} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sector</label>
                    <input className="form-input" name="sector" value={form.sector} onChange={h} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Area (m²) *</label>
                    <input className="form-input" name="area_m2" type="number" value={form.area_m2} onChange={h} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Land Use *</label>
                    <input className="form-input" name="land_use" value={form.land_use} onChange={h} />
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn-primary" onClick={() => saveParcel(!!editModal)} disabled={saving}>
                    {saving ? <><Ic.Spin /> Saving…</> : <><Ic.Check /> {editModal ? 'Save Changes' : 'Register Parcel'}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {confirmDelete && <ConfirmDialog title="Delete Parcel" message={`Delete UPI: ${confirmDelete.upi}?`} detail={`Owner: ${confirmDelete.owner_name || 'Unassigned'}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={async () => { setConfirmDelete(null); try { await fetch(`${API}/admin/land-parcels/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parcel_id: confirmDelete.id }) }); load(); addAlert('Parcel deleted.', 'success'); } catch { addAlert('Delete failed', 'error'); } }} onCancel={() => setConfirmDelete(null)} />}
      
      <div className="card">
        <div className="card-header" style={{ background: 'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <span className="card-header-title"><Ic.MapPin /> Land Parcels ({filtered.length})</span>
          <div className="card-header-actions">
            <div className="search-wrapper"><Ic.Search /><input className="search-input" placeholder="Search UPI or owner..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <button className="btn-primary-outline" onClick={() => { setShowAdd(true); setEditModal(null); setForm({...emptyForm}); }}><Ic.Add /> Register UPI</button>
          </div>
        </div>
        
        {loading && <div className="loading-state"><Ic.Spin /> Loading parcels…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No parcels registered yet.<br /><button className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAdd(true)}><Ic.Add /> Register First UPI</button></div>}
        {!loading && filtered.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>UPI</th><th>Owner</th><th>Province</th><th>District</th><th>Area (m²)</th><th>Land Use</th><th>Min/m²</th><th>Avg/m²</th><th>Max/m²</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="mono-text" style={{ color: '#0891b2', fontWeight: 700 }}>{p.upi}</td>
                    <td>{p.owner_name || <span className="text-muted">Unassigned</span>}</td>
                    <td>{p.province || '—'}</td><td>{p.district || '—'}</td>
                    <td>{p.area_in_meter_square ? Number(p.area_in_meter_square).toLocaleString() : '—'}</td>
                    <td>{p.land_use || '—'}</td>
                    <td className="price-min">{p.minimum_value_per_sqm ? Number(p.minimum_value_per_sqm).toLocaleString() : '—'}</td>
                    <td className="price-avg">{p.weighted_average_value_per_sqm ? Number(p.weighted_average_value_per_sqm).toLocaleString() : '—'}</td>
                    <td className="price-max">{p.maximum_value_per_sqm ? Number(p.maximum_value_per_sqm).toLocaleString() : '—'}</td>
                    <td><div className="action-buttons"><button className="btn-edit" onClick={() => { setForm({ upi: p.upi || '', user_id: p.owner_id || '', owner_national_id: p.owner_national_id || '', owner_name: p.owner_name || '', owner_sex: p.owner_sex || '', province: p.province || '', district: p.district || '', sector: p.sector || '', cell: p.cell || '', village: p.village || '', x: p.x || '', y: p.y || '', area_m2: p.area_in_meter_square || '', land_use: p.land_use || '', zoning: p.zoning || '', zoning_percentage: p.zoning_percentage || '', sentlement: p.sentlement || '', sentlement_percentage: p.sentlement_percentage || '', minimum_value_per_sqm: p.minimum_value_per_sqm || '', weighted_average_value_per_sqm: p.weighted_average_value_per_sqm || '', maximum_value_per_sqm: p.maximum_value_per_sqm || '' }); setEditModal(p); }}><Ic.Edit /> Edit</button><button className="btn-delete" onClick={() => setConfirmDelete(p)}><Ic.Trash /></button></div></td>
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

  const TABS = [{ id:'province', label:'Provinces' }, { id:'district', label:'Districts' }, { id:'sector', label:'Sectors' }, { id:'cell', label:'Cells' }, { id:'village', label:'Villages' }];

  const load = useCallback(async (tab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === 'province') { const r = await fetch(`${API}/locations/provinces`); const d = await r.json(); if (d.success) setProvinces(d.provinces || []); }
      else if (tab === 'district') { const r = await fetch(`${API}/locations/districts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setDistricts(d.districts || []); }
      else if (tab === 'sector') { const r = await fetch(`${API}/locations/sectors`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setSectors(d.sectors || []); }
      else if (tab === 'cell') { const r = await fetch(`${API}/locations/cells/by-sector`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setCells(d.cells || []); }
      else if (tab === 'village') { const r = await fetch(`${API}/locations/villages/by-cell`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setVillages(d.villages || []); }
    } catch { addAlert('Cannot connect', 'error'); }
    if (!silent) setLoading(false);
  }, [addAlert]);

  useEffect(() => { load(subTab); }, [subTab, load]);

  const [counts, setCounts] = useState({ province:0, district:0, sector:0, cell:0, village:0 });
  useEffect(() => { fetch(`${API}/locations/counts`).then(r=>r.json()).then(d => { if (d.success) setCounts(d.counts); }).catch(()=>{}); }, []);

  async function importAll() {
    if (!confirm('Import all locations from data.json?')) return;
    setImporting(true);
    try {
      const user = JSON.parse(localStorage.getItem('lpe_user') || '{}');
      const r = await fetch(`${API}/admin/import-locations`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ admin_id: user.id }) });
      const d = await r.json();
      if (d.success) { addAlert(`✓ Imported: ${d.stats.provinces} provinces, ${d.stats.districts} districts, ${d.stats.sectors} sectors, ${d.stats.cells} cells, ${d.stats.villages} villages`, 'success'); await Promise.all(['province','district','sector','cell','village'].map(tab => load(tab, true))); }
      else addAlert(d.message||'Import failed','error');
    } catch { addAlert('Cannot connect','error'); }
    setImporting(false);
  }

  function openAdd() { setEditItem(null); setForm({ name:'', province_id:'', district_id:'', sector_id:'', cell_id:'' }); setShowForm(true); }
  function openEdit(item) { setEditItem(item); setForm({ name: item.name||'', province_id: item.province_id||'', district_id: item.district_id||'', sector_id: item.sector_id||'', cell_id: item.cell_id||'' }); setShowForm(true); }

  async function saveItem() {
    if (!form.name.trim()) { addAlert('Name is required','error'); return; }
    const base = `${API}/locations/${subTab}s`;
    const body = { name: form.name };
    if (subTab==='district') body.province_id = form.province_id;
    if (subTab==='sector') body.district_id = form.district_id;
    if (subTab==='cell') body.sector_id = form.sector_id;
    if (subTab==='village') body.cell_id = form.cell_id;
    if (editItem) body.id = editItem.id;
    const url = editItem ? `${base}/update` : `${base}/create`;
    try {
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.success) { addAlert(editItem ? 'Updated!':'Created!','success'); setShowForm(false); load(subTab); }
      else addAlert(d.message||'Failed','error');
    } catch { addAlert('Cannot connect','error'); }
  }

  const currentList = { province:provinces, district:districts, sector:sectors, cell:cells, village:villages }[subTab] || [];
  const currentLabel = { province:'Province', district:'District', sector:'Sector', cell:'Cell', village:'Village' }[subTab];

  return (
    <div className="view">
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header"><div><div className="modal-title">{editItem ? `Edit ${currentLabel}` : `Add ${currentLabel}`}</div><div className="modal-subtitle">Location registry</div></div><button className="modal-close-btn" onClick={() => setShowForm(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-vertical">
                {subTab === 'district' && <div className="form-group"><label className="form-label">Province *</label><select className="form-select" value={form.province_id} onChange={e => setForm(f=>({...f, province_id:e.target.value}))}><option value="">— Select Province —</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
                {subTab === 'sector' && <div className="form-group"><label className="form-label">District *</label><select className="form-select" value={form.district_id} onChange={e => setForm(f=>({...f, district_id:e.target.value}))}><option value="">— Select District —</option>{districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>}
                {subTab === 'cell' && <div className="form-group"><label className="form-label">Sector *</label><select className="form-select" value={form.sector_id} onChange={e => setForm(f=>({...f, sector_id:e.target.value}))}><option value="">— Select Sector —</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
                {subTab === 'village' && <div className="form-group"><label className="form-label">Cell *</label><select className="form-select" value={form.cell_id} onChange={e => setForm(f=>({...f, cell_id:e.target.value}))}><option value="">— Select Cell —</option>{cells.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
                <div className="form-group"><label className="form-label">{currentLabel} Name *</label><input className="form-input" value={form.name} onChange={e => setForm(f=>({...f, name:e.target.value}))} placeholder={`e.g. ${currentLabel} name`} /></div>
                <div className="modal-actions"><button className="btn-primary" onClick={saveItem}><Ic.Check /> {editItem ? 'Save Changes' : `Add ${currentLabel}`}</button></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && <ConfirmDialog title={`Delete ${currentLabel}`} message={`Delete "${confirmDelete.name}"?`} detail="This cannot be undone." confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={async () => { setConfirmDelete(null); try { const r = await fetch(`${API}/locations/${subTab}s/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: confirmDelete.id }) }); const d = await r.json(); if (d.success) { addAlert('Deleted.','success'); load(subTab); } else addAlert(d.message||'Delete failed','error'); } catch { addAlert('Delete failed','error'); } }} onCancel={() => setConfirmDelete(null)} />}

      <div className="info-banner"><div className="info-banner-icon">📍</div><div><div className="info-banner-title">Location Registry</div><div className="info-banner-desc">Manage Rwanda's administrative hierarchy: Province → District → Sector → Cell → Village. Use <strong>Import All</strong> to bulk-load from JSON.</div></div></div>

      <div className="card">
        <div className="card-header" style={{ background: 'linear-gradient(135deg,#0891b2,#0d9488)' }}>
          <span className="card-header-title"><Ic.MapPin /> Locations</span>
          <div className="card-header-actions"><button className="btn-primary-outline" onClick={importAll} disabled={importing}>{importing ? <><Ic.Spin /> Importing…</> : <><Ic.Refresh /> Import All</>}</button><button className="btn-primary-outline" onClick={openAdd}><Ic.Add /> Add {currentLabel}</button></div>
        </div>
        
        <div className="role-tabs">{TABS.map(t => (<button key={t.id} className={`role-tab ${subTab===t.id?'active':''}`} onClick={() => setSubTab(t.id)}>{t.label}<span className="tab-count">{counts[t.id] ?? currentList.length}</span></button>))}</div>
        
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && currentList.length === 0 && <div className="empty-state">No {currentLabel.toLowerCase()}s yet.<br /><button className="btn-primary" style={{ marginTop:12 }} onClick={openAdd}><Ic.Add /> Add First {currentLabel}</button></div>}
        {!loading && currentList.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th>Actions</th></tr></thead>
              <tbody>{currentList.map((item, idx) => (<tr key={item.id}><td>{idx+1}</td><td style={{ fontWeight:700 }}>{item.name}</td><td><div className="action-buttons"><button className="btn-edit" onClick={() => openEdit(item)}><Ic.Edit /> Edit</button><button className="btn-delete" onClick={() => setConfirmDelete(item)}><Ic.Trash /></button></div></td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Transactions View ──
function ViewTransactions({ addAlert, user }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [docsModal, setDocsModal] = useState(null);
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (d.success) setTxs(d.transactions || []);
    } catch { addAlert('Cannot connect', 'error'); }
    if (!silent) setLoading(false);
  }, [addAlert]);

  const filtered = txs.filter(t => filterStatus === 'all' ? true : t.status === filterStatus);

  async function confirmMutation(t) {
    setConfirmModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: t.id }) });
      const d = await r.json();
      if (d.success) { await load(true); addAlert(`Mutation confirmed! Parcel transferred from ${t.seller_name} to ${t.buyer_name}`, 'success'); eventBus.emit('transactionChanged'); }
      else addAlert(d.message || 'Confirmation failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  async function rejectMutation(t) {
    if (!rejectReason.trim()) { addAlert('Please provide a reason for rejection', 'error'); return; }
    setRejectModal(null);
    try {
      const r = await fetch(`${API}/admin/mutations/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: t.id, reason: rejectReason }) });
      const d = await r.json();
      if (d.success) { await load(true); addAlert(`Mutation rejected: ${rejectReason.substring(0, 100)}`, 'warning'); eventBus.emit('transactionChanged'); }
      else addAlert(d.message || 'Rejection failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
    setRejectReason('');
  }

  async function deleteMutation(t) {
    setConfirmDelete(null);
    try {
      const r = await fetch(`${API}/admin/transactions/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: t.id }) });
      const d = await r.json();
      if (d.success) { await load(true); addAlert(`Mutation ${t.reference} deleted.`, 'success'); eventBus.emit('transactionChanged'); }
      else addAlert(d.message || 'Delete failed', 'error');
    } catch { addAlert('Cannot connect', 'error'); }
  }

  useEffect(() => { load(false); const interval = setInterval(() => load(true), 30000); const unsub = eventBus.on('transactionChanged', () => load(true)); return () => { clearInterval(interval); unsub(); }; }, [load]);

  const statusColor = s => ({ approved: '#0d9488', pending: '#f59e0b', rejected: '#ef4444', forwarded_to_admin: '#7c3aed', permission_granted: '#10b981' }[s] || '#94a3b8');
  const statusLabel = s => ({ approved: 'Approved', pending: 'Pending', rejected: 'Rejected', forwarded_to_admin: 'Awaiting Permission', permission_granted: 'Permission Granted' }[s] || s);
  const pendingCount = txs.filter(t => t.status === 'pending' || t.status === 'forwarded_to_admin').length;

  return (
    <div className="view">
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header"><div><div className="modal-title">Confirm Mutation</div><div className="modal-subtitle">Transfer ownership from seller to buyer</div></div><button onClick={() => setConfirmModal(null)} className="modal-close-btn">×</button></div>
            <div className="modal-body"><div className="info-box"><div><strong>UPI:</strong> {confirmModal.upi}</div><div><strong>Seller:</strong> {confirmModal.seller_name}</div><div><strong>Buyer:</strong> {confirmModal.buyer_name}</div><div><strong>Price:</strong> {Number(confirmModal.agreed_price || 0).toLocaleString()} RWF</div><div><strong>Notary:</strong> {confirmModal.notary_name || '—'}</div></div><div className="modal-actions"><button className="btn-success" onClick={() => confirmMutation(confirmModal)}><Ic.Check /> Confirm & Transfer</button></div></div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header"><div><div className="modal-title">Reject Mutation</div><div className="modal-subtitle">Provide reason for rejection</div></div><button onClick={() => setRejectModal(null)} className="modal-close-btn">×</button></div>
            <div className="modal-body"><div className="info-box"><div><strong>UPI:</strong> {rejectModal.upi}</div><div><strong>Seller:</strong> {rejectModal.seller_name} → <strong>Buyer:</strong> {rejectModal.buyer_name}</div></div><textarea className="form-textarea" rows={3} placeholder="Reason for rejection (required)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} /><div className="modal-actions"><button className="btn-danger" onClick={() => rejectMutation(rejectModal)}><Ic.X /> Reject Mutation</button></div></div>
          </div>
        </div>
      )}

      {confirmDelete && <ConfirmDialog title="Delete Mutation" message={`Delete mutation ${confirmDelete.reference}?`} detail={`Buyer: ${confirmDelete.buyer_name} ↔ Seller: ${confirmDelete.seller_name}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => deleteMutation(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}

      <div className="card">
        <div className="card-header"><span className="card-header-title"><Ic.Monitor /> All Mutations ({txs.length}){pendingCount > 0 && <span className="badge-pending">{pendingCount} pending</span>}</span></div>
        
        <div className="filter-tabs">{['all', 'pending', 'forwarded_to_admin', 'approved', 'rejected'].map(s => (<button key={s} onClick={() => setFilterStatus(s)} className={`filter-tab ${filterStatus === s ? 'active' : ''}`}>{s === 'forwarded_to_admin' ? 'Admin Review' : s === 'all' ? 'All' : s === 'pending' ? 'Pending' : s === 'approved' ? 'Approved' : 'Rejected'}</button>))}</div>

        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No mutations in {filterStatus === 'all' ? '' : filterStatus} status.</div>}
        {!loading && filtered.length > 0 && (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Reference</th><th>UPI</th><th>Buyer</th><th>Seller</th><th>Notary</th><th>Price (RWF)</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td className="mono-text" style={{ color: '#0d9488', fontWeight: 700 }}>{t.reference}</td>
                    <td className="mono-text">{t.upi}</td>
                    <td>{t.buyer_name}</td><td>{t.seller_name}</td>
                    <td style={{ color: '#7c3aed', fontWeight: 600 }}>{t.notary_name || '—'}</td>
                    <td className="price-text">{Number(t.agreed_price || 0).toLocaleString()}</td>
                    <td><span style={{ color: statusColor(t.status), fontWeight: 700 }}>● {statusLabel(t.status)}{t.status === 'rejected' && t.rejection_reason && <div className="rejection-reason">{t.rejection_reason.substring(0, 30)}</div>}</span></td>
                    <td className="date-text">{fmtDate(t.created_at)}</td>
                    <td><div className="action-buttons">{t.status === 'pending' && t.notary_type === 'private' && (<><button className="btn-success-small" onClick={() => setConfirmModal(t)}>Confirm</button><button className="btn-danger-small" onClick={() => setRejectModal(t)}>Reject</button></>)}<button className="btn-edit" onClick={() => setEditModal(t)}><Ic.Edit /></button><button className="btn-delete" onClick={() => setConfirmDelete(t)}><Ic.Trash /></button></div></td>
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

// ── ViewPredict ──
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

  return (
    <div className="view">
      <div className="card">
        <div className="card-header"><Ic.Search /> Search Land Data by UPI</div>
        <div className="card-body">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper"><Ic.Search /><input className="search-input-large" placeholder="e.g. xx/xx/xx/xx/xxxx" value={upi} onChange={e => setUpi(e.target.value)} required /></div>
            <button className="btn-primary" type="submit" disabled={searching || predLoad}>{searching || predLoad ? <><Ic.Spin /> Searching…</> : <><Ic.Search /> Search & Estimate</>}</button>
          </form>
        </div>
        {landData && (
          <div className="card-section">
            <div className="section-subtitle">Parcel: {landData.UPI}</div>
            <div className="info-grid">
              {Object.entries(landData).filter(([k]) => k !== '_source').map(([k,v]) => (<div key={k} className="info-card"><div className="info-label">{k.replace(/_/g,' ')}</div><div className="info-value">{String(v) || '—'}</div></div>))}
            </div>
          </div>
        )}
        {predLoad && <div className="loading-state"><Ic.Spin /> Running AI estimation model…</div>}
        {predErr && <div className="error-message">{predErr}</div>}
        {preds && !predLoad && (
          <div className="card-section">
            <button className="btn-primary-outline full-width" onClick={() => setShowPreds(v => !v)}><Ic.Predict /> {showPreds ? 'Hide AI Price Estimation' : 'View AI Price Estimation'}</button>
            {showPreds && (
              <div className="price-cards">
                <div className="price-card-min"><div className="price-card-title">Minimum</div><div className="price-card-value">{Math.round(preds.min_price).toLocaleString()} RWF</div><div className="price-card-sub">{parseFloat(preds.min_per_sqm).toLocaleString()} RWF/m²</div></div>
                <div className="price-card-avg"><div className="price-card-title">Average</div><div className="price-card-value">{Math.round(preds.avg_price).toLocaleString()} RWF</div><div className="price-card-sub">{parseFloat(preds.avg_per_sqm).toLocaleString()} RWF/m²</div></div>
                <div className="price-card-max"><div className="price-card-title">Maximum</div><div className="price-card-value">{Math.round(preds.max_price).toLocaleString()} RWF</div><div className="price-card-sub">{parseFloat(preds.max_per_sqm).toLocaleString()} RWF/m²</div></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ViewSuggestions ──
function ViewSuggestions({ addAlert }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const load = useCallback(() => { setLoading(true); fetch(`${API}/suggestions/all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(r=>r.json()).then(d=>{ if(d.success) setSuggestions(d.suggestions||[]); }).catch(()=>addAlert('Cannot connect','error')).finally(()=>setLoading(false)); }, [addAlert]);
  async function deleteSuggestion(id) { setConfirmDelete(null); try { const r = await fetch(`${API}/admin/suggestions/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suggestion_id: id }) }); const d = await r.json(); if (d.success) { load(); addAlert('Suggestion deleted.','success'); } else addAlert(d.message || 'Delete failed','error'); } catch { addAlert('Delete failed','error'); } }
  async function deleteAllSuggestions() { setConfirmDeleteAll(false); try { const r = await fetch(`${API}/admin/suggestions/delete-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) { load(); addAlert('All suggestions deleted.','success'); } else addAlert(d.message || 'Delete failed','error'); } catch { addAlert('Delete failed','error'); } }
  useEffect(() => { load(); const unsub = eventBus.on('suggestionAdded', () => load()); return () => unsub(); }, [load]);

  const CATS = { general:'#6366f1', feature:'#0d9488', bug:'#ef4444', transaction:'#f59e0b', pricing:'#ec4899' };
  const catLabel = c => ({ general:'General', feature:'Feature', bug:'Bug', transaction:'Transaction', pricing:'Pricing' }[c] || c);
  const ratingStars = n => <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i<=n?'#f59e0b':'#d1d5db' }}>★</span>)}</span>;

  return (
    <div className="view">
      {confirmDelete && <ConfirmDialog title="Delete Suggestion" message="Delete this suggestion?" detail={confirmDelete.message?.substring(0,100)} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => deleteSuggestion(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteAll && <ConfirmDialog title="Delete All Suggestions" message={`Delete ALL ${suggestions.length} suggestions?`} detail="This action cannot be undone." confirmText="Yes, Delete All" confirmColor="#ef4444" onConfirm={deleteAllSuggestions} onCancel={() => setConfirmDeleteAll(false)} />}
      
      <div className="card">
        <div className="card-header"><span className="card-header-title"><Ic.Suggestions /> User Suggestions ({suggestions.length})</span>{suggestions.length > 0 && <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)}><Ic.Trash /> Delete All</button>}</div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && suggestions.length === 0 && <div className="empty-state">No suggestions yet.</div>}
      </div>
      
      {!loading && suggestions.map(s => {
        const color = CATS[s.category] || '#6366f1';
        return (<div key={s.id} className="suggestion-card"><div className="suggestion-header"><div className="suggestion-tags"><span className="suggestion-category" style={{ background: `${color}18`, color }}>{catLabel(s.category)}</span>{s.rating > 0 && ratingStars(s.rating)}<span className="suggestion-meta">{s.user_name || 'Anonymous'} · {fmtDate(s.created_at)}</span></div><button onClick={() => setConfirmDelete(s)} className="btn-delete-small"><Ic.Trash /></button></div><div className="suggestion-message">{s.message}</div></div>);
      })}
    </div>
  );
}

// ── ViewReportsAndInbox ──
function ViewReportsAndInbox({ addAlert }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const loadInbox = useCallback(async () => { setLoading(true); try { const r = await fetch(`${API}/admin/inbox`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setReports(d.reports || []); } catch { addAlert('Cannot connect','error'); } setLoading(false); }, [addAlert]);
  async function deleteReport(reportId) { setConfirmDelete(null); try { const r = await fetch(`${API}/admin/reports/delete`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ report_id: reportId }) }); const d = await r.json(); if (d.success) { loadInbox(); addAlert('Report deleted.','success'); } else addAlert(d.message || 'Delete failed','error'); } catch { addAlert('Delete failed','error'); } }
  async function deleteAllReports() { setConfirmDeleteAll(false); try { const r = await fetch(`${API}/admin/reports/delete-all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) { loadInbox(); addAlert('All reports deleted.','success'); } else addAlert(d.message || 'Delete failed','error'); } catch { addAlert('Delete failed','error'); } }
  useEffect(() => { loadInbox(); const unsub = eventBus.on('reportGenerated', () => loadInbox()); return () => unsub(); }, [loadInbox]);

  const unread = reports.filter(r => !r.read).length;
  const typeLabels = { summary:'Summary', parcels:'Parcels', officers:'Officers', pending:'Pending', mutations:'Mutations', approved:'Approved', rejected:'Rejected' };

  return (
    <div className="view">
      {confirmDelete && <ConfirmDialog title="Delete Report" message={`Delete report ${confirmDelete.reference}?`} detail={`From: ${confirmDelete.from_name}`} confirmText="Yes, Delete" confirmColor="#ef4444" onConfirm={() => deleteReport(confirmDelete.id)} onCancel={() => setConfirmDelete(null)} />}
      {confirmDeleteAll && <ConfirmDialog title="Delete All Reports" message={`Delete ALL ${reports.length} reports?`} detail="This action cannot be undone." confirmText="Yes, Delete All" confirmColor="#ef4444" onConfirm={deleteAllReports} onCancel={() => setConfirmDeleteAll(false)} />}
      
      <div className="card"><div className="card-header"><span className="card-header-title"><Ic.Report /> Reports Inbox{unread > 0 && <span className="badge-new">{unread} new</span>}</span>{reports.length > 0 && <button className="btn-danger" onClick={() => setConfirmDeleteAll(true)}><Ic.Trash /> Delete All</button>}</div>{loading && <div className="loading-state"><Ic.Spin /> Loading inbox…</div>}{!loading && reports.length === 0 && <div className="empty-state">Inbox is empty.</div>}</div>
      
      {!loading && reports.map(rpt => (<div key={rpt.id} className="report-card"><div className="report-header"><div><div className="report-reference">{rpt.reference}{!rpt.read && <span className="badge-new">NEW</span>}<span className="report-type">{typeLabels[rpt.type] || rpt.type}</span></div><div className="report-sender"><div className="sender-avatar">{rpt.from_name?.[0]?.toUpperCase()}</div><div><div className="sender-name">{rpt.from_name}</div><div className="sender-date">{fmtDate(rpt.sent_at)}</div></div></div></div><div className="report-actions"><button onClick={() => setExpanded(expanded === rpt.id ? null : rpt.id)} className="btn-view">{expanded === rpt.id ? 'Close' : 'View Report'}</button><button onClick={() => setConfirmDelete(rpt)} className="btn-delete"><Ic.Trash /></button></div></div>{expanded === rpt.id && <div className="report-content"><pre>{rpt.content || '(No content)'}</pre></div>}</div>))}
    </div>
  );
}

// ── ViewPriceTrends ──
function ViewPriceTrends({ addAlert }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('year');
  const [metric, setMetric] = useState('avg');

  const load = useCallback(async () => { setLoading(true); try { const r = await fetch(`${API}/admin/stamped-records`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); const d = await r.json(); if (d.success) setRecords(d.records || []); else addAlert(d.message || 'Failed to load records', 'error'); } catch { addAlert('Cannot connect', 'error'); } setLoading(false); }, [addAlert]);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = {};
    records.forEach(rec => { const date = rec.stamped_at || rec.signed_date; if (!date) return; const d = new Date(date); if (isNaN(d)) return; const key = groupBy === 'year' ? String(d.getFullYear()) : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; if (!map[key]) map[key] = { agreed: [], ml_avg: [], ml_min: [], ml_max: [], count: 0 }; if (rec.agreed_price) map[key].agreed.push(Number(rec.agreed_price)); if (rec.ml_avg_price) map[key].ml_avg.push(Number(rec.ml_avg_price)); if (rec.ml_min_price) map[key].ml_min.push(Number(rec.ml_min_price)); if (rec.ml_max_price) map[key].ml_max.push(Number(rec.ml_max_price)); map[key].count++; });
    const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
    const getMlValue = (v, metricType) => { if (metricType === 'min') return avg(v.ml_min); if (metricType === 'max') return avg(v.ml_max); return avg(v.ml_avg); };
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([period,v]) => ({ period, agreed: avg(v.agreed), ml: getMlValue(v, metric), count: v.count, diff: avg(v.agreed) != null && getMlValue(v, metric) != null ? avg(v.agreed) - getMlValue(v, metric) : null, pct: avg(v.agreed) != null && getMlValue(v, metric) != null && getMlValue(v, metric) !== 0 ? (((avg(v.agreed) - getMlValue(v, metric)) / getMlValue(v, metric)) * 100).toFixed(1) : null }));
  }, [records, groupBy, metric]);

  const metricLabel = { min: 'Minimum', avg: 'Average', max: 'Maximum' }[metric];

  return (
    <div className="view">
      <div className="info-banner"><div className="info-banner-icon">📈</div><div><div className="info-banner-title">Price Trends — Agreed vs ML Model Price ({metricLabel})</div><div className="info-banner-desc">Based on <strong>{records.length}</strong> stamped records.</div></div></div>
      
      <div className="filter-group"><div className="filter-buttons">{['year','month'].map(v => (<button key={v} className={`filter-btn ${groupBy === v ? 'active' : ''}`} onClick={() => setGroupBy(v)}>{v === 'year' ? 'By Year' : 'By Month'}</button>))}</div><div className="filter-buttons">{['min','avg','max'].map(v => (<button key={v} className={`filter-btn ${metric === v ? 'active' : ''}`} onClick={() => setMetric(v)}>{v === 'min' ? 'Minimum' : v === 'avg' ? 'Average' : 'Maximum'}</button>))}</div></div>

      <div className="card"><div className="card-header" style={{ background: 'linear-gradient(135deg,#0891b2,#0d9488)' }}>Price Trend Chart — {metricLabel} per {groupBy}</div>{loading && <div className="loading-state"><Ic.Spin /> Loading records…</div>}{!loading && grouped.length === 0 && <div className="empty-state">No stamped records with valid dates found.</div>}{!loading && grouped.length > 0 && (<div className="table-responsive"><table className="data-table"><thead><tr><th>Period</th><th>Sales</th><th>Agreed Price</th><th>ML Model Price</th><th>Difference</th><th>Deviation %</th></tr></thead><tbody>{grouped.map(g => (<tr key={g.period}><td style={{ fontWeight:700 }}>{g.period}</td><td>{g.count}</td><td className="price-text">{g.agreed?.toLocaleString()} RWF</td><td className="price-avg">{g.ml?.toLocaleString()} RWF</td><td className={g.diff > 0 ? 'price-negative' : g.diff < 0 ? 'price-positive' : ''}>{g.diff != null ? (g.diff > 0 ? '+' : '') + g.diff.toLocaleString() + ' RWF' : '—'}</td><td>{g.pct != null ? <span className={g.pct > 0 ? 'badge-negative' : g.pct < 0 ? 'badge-positive' : 'badge-neutral'}>{g.pct > 0 ? '+' : ''}{g.pct}%</span> : '—'}</td></tr>))}</tbody></table></div>)}</div>
    </div>
  );
}

// ── ViewSettings ──
function ViewSettings({ addAlert }) {
  const [settings, setSettings] = useState({ system_name:'Land Price Estimation System', tax_free_threshold:'5000000', tax_rate:'2.5', allow_self_registration:true, require_notary_approval:true, require_sector_verification:true, max_price_rw:'1000000000', default_currency:'RWF', maintenance_mode:false, email_notifications:true });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveSettings() { setLoading(true); try { const r = await fetch(`${API}/admin/settings`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) }); const d = await r.json(); if (d.success) { addAlert('Settings saved!','success'); setSaved(true); setTimeout(()=>setSaved(false),3000); } else addAlert(d.message || 'Save failed','error'); } catch { addAlert('Settings saved locally (server offline).','success'); setSaved(true); setTimeout(()=>setSaved(false),3000); } setLoading(false); }
  const h = e => setSettings(s => ({ ...s, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="view">
      <div className="info-banner"><div className="info-banner-icon">⚙️</div><div><div className="info-banner-title">System Settings</div><div className="info-banner-desc">These settings control the behavior of the entire LPES platform. Changes take effect immediately after saving.</div></div></div>
      
      <div className="card"><div className="card-header" style={{ background: 'linear-gradient(135deg,#0d9488,#0d9488bb)' }}>General Configuration</div><div className="card-body"><div className="settings-grid"><div className="form-group"><label className="form-label">System Name</label><input className="form-input" name="system_name" value={settings.system_name} onChange={h} /></div><div className="form-group"><label className="form-label">Default Currency</label><input className="form-input" name="default_currency" value={settings.default_currency} onChange={h} /></div><div className="form-group"><label className="form-label">Tax-Free Threshold (RWF)</label><input className="form-input" type="number" name="tax_free_threshold" value={settings.tax_free_threshold} onChange={h} /></div><div className="form-group"><label className="form-label">Capital Gains Tax Rate (%)</label><input className="form-input" type="number" step="0.1" name="tax_rate" value={settings.tax_rate} onChange={h} /></div><div className="form-group"><label className="form-label">Max Allowed Price (RWF)</label><input className="form-input" type="number" name="max_price_rw" value={settings.max_price_rw} onChange={h} /></div></div></div></div>
      
      <div className="card"><div className="card-header" style={{ background: 'linear-gradient(135deg,#8b5cf6,#8b5cf6bb)' }}>System Toggles</div><div className="card-body"><div className="toggles-list">{['allow_self_registration','require_notary_approval','require_sector_verification','email_notifications','maintenance_mode'].map(t => (<div key={t} className="toggle-item"><div><div className="toggle-label">{t.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}</div><div className="toggle-desc">{t === 'allow_self_registration' ? 'Buyers/Sellers can register themselves' : t === 'require_notary_approval' ? 'Mutations must be certified by a notary' : t === 'require_sector_verification' ? 'Parcels must be verified by sector officer' : t === 'email_notifications' ? 'Send email alerts for important events' : 'Lock system for non-admin users'}</div></div><label className="toggle-switch"><input type="checkbox" name={t} checked={settings[t]} onChange={h} /><span className="toggle-slider"></span></label></div>))}</div></div></div>
      
      <div className="settings-actions"><button className="btn-primary" onClick={saveSettings} disabled={loading}>{loading ? <><Ic.Spin /> Saving…</> : saved ? <><Ic.Check /> Saved!</> : <><Ic.Save /> Save Settings</>}</button></div>
    </div>
  );
}

// ── ROOT ADMIN DASHBOARD ──
export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState({ total:0, district:0, notaries:0, notary_sector:0, notary_private:0, txs:0, stamped_records:0 });
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [seenSuggCount, setSeenSuggCount] = useState(0);
  const [unreadReports, setUnreadReports] = useState(0);
  const [seenReportCount, setSeenReportCount] = useState(0);
  const [reportsBadgeDismissed, setReportsBadgeDismissed] = useState(false);
  const [pendingMutationsCount, setPendingMutationsCount] = useState(0);
  const [seenMutationsCount, setSeenMutationsCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const photoInputRef = useRef(null);
  const userMenuRef = useRef(null);

  const handleSetActive = useCallback((id) => { setActive(id); if (id === 'suggestions') { setSeenSuggCount(suggestionCount); localStorage.setItem('lpes_admin_seen_sugg', String(suggestionCount)); } if (id === 'reports') { setSeenReportCount(unreadReports); setReportsBadgeDismissed(true); localStorage.setItem('lpes_admin_seen_reports', String(unreadReports)); localStorage.setItem('lpes_admin_reports_dismissed', 'true'); } if (id === 'transactions') { setSeenMutationsCount(pendingMutationsCount); localStorage.setItem('lpes_admin_seen_mutations', String(pendingMutationsCount)); } }, [suggestionCount, unreadReports, pendingMutationsCount]);

  useEffect(() => { if (user?.id) { const saved = localStorage.getItem(`lpes_photo_admin_${user.id}`); if (saved) setProfilePhoto(saved); } }, [user?.id]);

  const fetchStats = useCallback(() => { fetch(`${API}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(r=>r.json()).then(d=>{ if(d.success) setStats({ ...d.stats, txs: d.stats.txs || 0, notary_sector: d.stats.notary_sector ?? 0, notary_private: d.stats.notary_private ?? 0, stamped_records: d.stats.stamped_records ?? 0 }); }).catch(()=>{}); }, []);
  useEffect(() => { fetchStats(); const u1 = eventBus.on('userChanged', () => fetchStats()); const u2 = eventBus.on('transactionChanged', () => fetchStats()); return () => { u1(); u2(); }; }, [fetchStats]);

  useEffect(() => { function fetchPendingMutations() { fetch(`${API}/transactions/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r=>r.json()).then(d=>{ if(d.success) setPendingMutationsCount((d.transactions||[]).filter(t=>t.status==='pending').length); }).catch(()=>{}); } fetchPendingMutations(); const interval = setInterval(fetchPendingMutations, 15000); return ()=>clearInterval(interval); }, []);
  useEffect(() => { function fetchSuggCount() { fetch(`${API}/suggestions/all`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(r=>r.json()).then(d=>{ if(d.success) setSuggestionCount((d.suggestions||[]).length); }).catch(()=>{}); } fetchSuggCount(); const interval = setInterval(fetchSuggCount, 30000); return ()=>clearInterval(interval); }, []);
  useEffect(() => { function fetchReportCount() { fetch(`${API}/admin/inbox`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(r=>r.json()).then(d=>{ if(d.success) setUnreadReports((d.reports||[]).length); }).catch(()=>{}); } fetchReportCount(); const interval = setInterval(fetchReportCount, 30000); return ()=>clearInterval(interval); }, []);

  useEffect(() => { function fn(e) { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); } document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn); }, []);
  useEffect(() => { const handleResize = () => { if (window.innerWidth > 768) setSidebarOpen(true); }; window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);

  if (!user) return <div className="loading-screen"><Ic.Spin /> Loading…</div>;

  function doLogout() { localStorage.removeItem('lpe_user'); router.push('/'); }
  function handlePhotoChange(e) { const file = e.target.files?.[0]; if(!file) return; if(file.size > 5*1024*1024){ addAlert('Photo must be under 5MB','error'); return; } const reader = new FileReader(); reader.onload = ev => { const data = ev.target.result; setProfilePhoto(data); localStorage.setItem(`lpes_photo_admin_${user.id}`, data); addAlert('Profile photo updated!','success'); }; reader.readAsDataURL(file); }
  const initials = user?.name?.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]?.toUpperCase()).join('') || 'AD';
  const TITLES = { dashboard:'Overview', users:'All Users', district:'District Officers', land_parcels:'Land Parcels', locations:'Locations', private_notaries:'Private Notaries', transactions:'Mutations', stamped_records:'Stamped Records', predict:'Land & Estimation', suggestions:'Suggestions', price_trends:'Price Trends', reports:'Reports Inbox', settings:'Settings' };

  function renderContent() {
    switch(active){
      case 'dashboard': return <ViewDashboard setActive={handleSetActive} stats={stats} />;
      case 'users': return <ViewUsers addAlert={addAlert} />;
      case 'district': return <ViewRoleManagement role="district_land_officer" accentColor="#0891b2" addAlert={addAlert} />;
      case 'private_notaries': return <ViewRoleManagement role="notary" notaryType="private" accentColor="#a855f7" addAlert={addAlert} />;
      case 'land_parcels': return <ViewLandParcels addAlert={addAlert} />;
      case 'locations': return <ViewLocations addAlert={addAlert} />;
      case 'stamped_records': return <ViewStampedRecords addAlert={addAlert} />;
      case 'transactions': return <ViewTransactions addAlert={addAlert} user={user} />;
      case 'price_trends': return <ViewPriceTrends addAlert={addAlert} />;
      case 'predict': return <ViewPredict addAlert={addAlert} />;
      case 'suggestions': return <ViewSuggestions addAlert={addAlert} />;
      case 'reports': return <ViewReportsAndInbox addAlert={addAlert} />;
      case 'settings': return <ViewSettings addAlert={addAlert} />;
      default: return <ViewDashboard setActive={setActive} stats={stats} />;
    }
  }

  return (
    <>
      <Head>
        <title>{TITLES[active]} — Admin · LPES</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>
      
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Syne', 'Times New Roman', Times, serif; background: #f0fdfa; color: #0c1a19; overflow-x: hidden; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        /* Toast Notifications */
        .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
        .toast { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: fadeUp 0.3s ease; border-left: 4px solid; }
        .toast-success { border-left-color: #0d9488; }
        .toast-error { border-left-color: #ef4444; }
        .toast-warning { border-left-color: #f59e0b; }
        .toast-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .toast-success .toast-icon { background: rgba(13,148,136,0.1); color: #0d9488; }
        .toast-error .toast-icon { background: rgba(239,68,68,0.1); color: #ef4444; }
        .toast-message { flex: 1; font-size: 13px; font-weight: 500; }
        .toast-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #9ca3af; padding: 0 4px; }
        
        /* Layout */
        .shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .shell-body { display: flex; flex: 1; overflow: hidden; position: relative; }
        
        /* Topbar */
        .topbar { height: 60px; background: #0f172a; display: flex; align-items: center; flex-shrink: 0; position: relative; z-index: 200; }
        .topbar-brand { width: 260px; flex-shrink: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #00102a; border-bottom: 3px solid white; border-radius: 0 0 10px 10px; }
        .topbar-brand-acronym { font-size: 18px; font-weight: 800; color: #60a5fa; letter-spacing: 3px; }
        .topbar-brand-tagline { font-size: 8px; color: rgba(255,255,255,0.6); margin-top: 2px; }
        .topbar-expand-btn { display: flex; align-items: center; justify-content: center; width: 70px; height: 100%; background: white; border: none; border-right: 1px solid #e5e7eb; cursor: pointer; }
        .topbar-title { flex: 1; font-size: 13px; color: rgba(255,255,255,0.65); padding: 0 16px; font-style: italic; }
        .topbar-user { display: flex; align-items: center; gap: 8px; padding: 6px 16px; margin-right: 16px; background: white; border-radius: 8px; cursor: pointer; }
        .topbar-user-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#0d9488,#0891b2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
        .topbar-user-name { font-size: 13px; font-weight: 600; }
        .topbar-role { font-size: 12px; color: #6b7280; }
        
        /* Sidebar */
        .sidebar { width: 260px; background: #0f172a; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s ease; overflow-y: auto; z-index: 100; }
        @media (max-width: 768px) { .sidebar { position: fixed; top: 60px; left: 0; bottom: 0; transform: translateX(-100%); } .sidebar-open { transform: translateX(0); } .sidebar-closed { transform: translateX(-100%); } }
        .sidebar-nav { padding: 16px 12px; }
        .sidebar-section { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; padding: 0 8px 10px; letter-spacing: 1px; }
        .sidebar-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 10px; background: transparent; border: none; color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; transition: all 0.2s; }
        .sidebar-item:hover { background: rgba(255,255,255,0.06); color: white; }
        .sidebar-item.active { background: rgba(13,148,136,0.2); color: #0d9488; }
        .sidebar-item.has-badge { background: rgba(239,68,68,0.07); }
        .sidebar-badge-dot { position: absolute; top: -3px; right: -4px; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.5s infinite; }
        .sidebar-icon { position: relative; display: flex; }
        .sidebar-active-pip { width: 4px; height: 4px; border-radius: 50%; background: #0d9488; margin-left: auto; }
        
        /* Main Content */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .content { flex: 1; overflow-y: auto; padding: 20px; }
        @media (max-width: 768px) { .content { padding: 12px; } }
        
        /* Views */
        .view { display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto; width: 100%; }
        
        /* Stats Grid */
        .stats-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr; } }
        .stat-card { background: white; border: 1px solid #ccf2ee; border-radius: 16px; padding: 20px; transition: all 0.2s; }
        .stat-card.clickable { cursor: pointer; }
        .stat-card.clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,148,136,0.15); border-color: #0d9488; }
        .stat-value { font-size: 28px; font-weight: 800; color: #0c1a19; }
        .stat-label { font-size: 13px; font-weight: 600; margin-top: 4px; }
        .stat-sub { font-size: 11px; color: #4d7c77; margin-top: 2px; }
        
        /* Quick Actions */
        .section-label { font-size: 11px; font-weight: 700; color: #4d7c77; text-transform: uppercase; letter-spacing: 1px; }
        .qa-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        @media (max-width: 640px) { .qa-grid { grid-template-columns: 1fr; } }
        .qa-card { background: white; border: 1.5px solid #ccf2ee; border-radius: 16px; padding: 16px; cursor: pointer; text-align: left; transition: all 0.2s; }
        .qa-card:hover { border-color: #0d9488; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,148,136,0.1); }
        .qa-dot { width: 10px; height: 10px; border-radius: 50%; margin-bottom: 10px; }
        .qa-label { font-size: 14px; font-weight: 700; }
        .qa-desc { font-size: 12px; color: #4d7c77; margin-top: 4px; }
        
        /* Cards */
        .card { background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(13,148,136,0.08); border: 1px solid #ccf2ee; overflow: hidden; }
        .card-header { background: linear-gradient(135deg, #0d9488, #0891b2); color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        @media (max-width: 640px) { .card-header { flex-direction: column; align-items: stretch; } }
        .card-header-title { display: flex; align-items: center; gap: 8px; font-weight: 700; }
        .card-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .card-body { padding: 20px; }
        .card-section { padding: 16px 20px; border-top: 1px solid #ccf2ee; }
        
        /* Tables */
        .table-responsive { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .data-table th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; color: #4d7c77; background: #f9fefd; border-bottom: 1px solid #ccf2ee; }
        .data-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f0fdfa; }
        .data-table tr:hover td { background: #f9fefd; }
        
        /* Role Tabs */
        .role-tabs { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid #ccf2ee; }
        @media (max-width: 640px) { .role-tabs { flex-wrap: nowrap; overflow-x: auto; } }
        .role-tab { padding: 6px 14px; border-radius: 40px; background: #f0fdfa; border: 1.5px solid #ccf2ee; font-size: 12px; font-weight: 600; color: #4d7c77; cursor: pointer; white-space: nowrap; }
        .role-tab.active { background: #0d9488; color: white; border-color: #0d9488; }
        .tab-count { background: rgba(13,148,136,0.15); border-radius: 40px; padding: 2px 7px; font-size: 11px; margin-left: 6px; }
        
        /* Filter Tabs */
        .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 12px 20px; border-bottom: 1px solid #ccf2ee; }
        .filter-tab { padding: 5px 12px; border-radius: 20px; background: #f0fdfa; border: 1px solid #ccf2ee; font-size: 11px; font-weight: 600; cursor: pointer; }
        .filter-tab.active { background: #0d9488; color: white; }
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
        .filter-buttons { display: flex; gap: 6px; }
        .filter-btn { padding: 6px 14px; border-radius: 40px; background: #f0fdfa; border: 1px solid #ccf2ee; font-size: 12px; cursor: pointer; }
        .filter-btn.active { background: #0d9488; color: white; }
        
        /* Officer Cards */
        .officer-card { display: flex; align-items: center; gap: 14px; background: #f0fdfa; border: 1px solid #ccf2ee; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; }
        @media (max-width: 640px) { .officer-card { flex-direction: column; align-items: flex-start; } }
        .officer-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0; }
        .officer-info { flex: 1; }
        .officer-name { font-weight: 700; font-size: 14px; }
        .officer-details { font-size: 11px; color: #4d7c77; margin-top: 2px; }
        .pending-card { background: #fffbeb; border-color: #fde68a; }
        
        /* Info Banner */
        .info-banner { display: flex; gap: 16px; background: rgba(13,148,136,0.04); border: 1px solid rgba(13,148,136,0.15); border-radius: 16px; padding: 16px 20px; }
        @media (max-width: 640px) { .info-banner { flex-direction: column; } }
        .info-banner-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(13,148,136,0.1); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .info-banner-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .info-banner-desc { font-size: 12px; color: #4d7c77; line-height: 1.5; }
        
        /* Forms */
        .form-vertical { display: flex; flex-direction: column; gap: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } }
        .form-label { font-size: 10px; font-weight: 700; color: #4d7c77; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-input, .form-select, .form-textarea { padding: 10px 14px; font-size: 13px; font-family: inherit; background: #f0fdfa; border: 1.5px solid #ccf2ee; border-radius: 10px; outline: none; transition: all 0.2s; width: 100%; }
        .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,0.1); background: white; }
        .form-error { font-size: 11px; color: #ef4444; margin-top: 4px; }
        .form-success { font-size: 11px; color: #16a34a; margin-top: 4px; }
        
        /* Search */
        .search-wrapper { display: flex; align-items: center; gap: 8px; background: #f0fdfa; border: 1.5px solid #ccf2ee; border-radius: 40px; padding: 6px 14px; }
        .search-input { border: none; background: transparent; outline: none; font-size: 13px; min-width: 180px; }
        @media (max-width: 640px) { .search-wrapper { width: 100%; } .search-input { width: 100%; } }
        .search-form { display: flex; gap: 12px; flex-wrap: wrap; }
        .search-input-wrapper { flex: 1; display: flex; align-items: center; gap: 10px; background: #f0fdfa; border: 1.5px solid #ccf2ee; border-radius: 10px; padding: 0 14px; }
        .search-input-large { flex: 1; padding: 12px 0; border: none; background: transparent; outline: none; font-size: 14px; }
        
        /* Buttons */
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #0d9488, #0891b2); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13,148,136,0.3); }
        .btn-primary-outline { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); border-radius: 10px; color: white; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-danger { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #ef4444, #dc2626); border: none; border-radius: 10px; color: white; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-edit { background: rgba(13,148,136,0.1); color: #0d9488; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
        .btn-delete { background: rgba(239,68,68,0.08); color: #ef4444; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; }
        .btn-approve { background: rgba(34,197,94,0.1); color: #16a34a; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
        .btn-success-small { background: rgba(16,185,129,0.1); color: #10b981; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .btn-danger-small { background: rgba(239,68,68,0.1); color: #ef4444; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .action-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
        
        /* Modals */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px; }
        .modal-container { background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow: hidden; animation: modalIn 0.2s ease; }
        .modal-large { max-width: 700px; }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px; border-bottom: 1px solid #ccf2ee; }
        .modal-title { font-size: 18px; font-weight: 800; }
        .modal-subtitle { font-size: 12px; color: #4d7c77; margin-top: 4px; }
        .modal-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; padding: 0 8px; }
        .modal-body { padding: 20px 24px; overflow-y: auto; max-height: calc(90vh - 80px); }
        .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
        .modal-confirm { background: white; border-radius: 20px; max-width: 420px; width: 100%; padding: 24px; }
        .modal-confirm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .modal-confirm-title { font-size: 18px; font-weight: 800; }
        .modal-confirm-message { font-size: 14px; color: #374151; margin-bottom: 12px; }
        .modal-confirm-detail { font-size: 12px; color: #4d7c77; background: #f9fefd; border: 1px solid #ccf2ee; border-radius: 8px; padding: 10px; margin-bottom: 16px; }
        .modal-confirm-actions { display: flex; gap: 10px; }
        .modal-confirm-btn { padding: 10px 20px; border-radius: 10px; border: none; color: white; font-weight: 700; cursor: pointer; flex: 1; }
        
        /* Loading & Empty States */
        .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: #4d7c77; }
        .empty-state { text-align: center; padding: 48px; color: #4d7c77; }
        .loading-screen { display: flex; height: 100vh; align-items: center; justify-content: center; background: #f0fdfa; gap: 12px; }
        
        /* Suggestion & Report Cards */
        .suggestion-card { background: white; border: 1px solid #ccf2ee; border-radius: 14px; padding: 16px 20px; margin-top: 12px; }
        .suggestion-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .suggestion-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .suggestion-category { padding: 3px 10px; border-radius: 40px; font-size: 11px; font-weight: 600; }
        .suggestion-meta { font-size: 11px; color: #94a3b8; }
        .suggestion-message { font-size: 13px; line-height: 1.6; color: #1e293b; background: #f8fafc; border-radius: 8px; padding: 12px; border-left: 3px solid; }
        .report-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin-top: 12px; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .report-reference { font-family: monospace; font-weight: 700; color: #0d9488; font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .report-type { background: rgba(13,148,136,0.1); color: #0d9488; padding: 2px 8px; border-radius: 20px; font-size: 11px; }
        .report-sender { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
        .sender-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#0d9488,#0891b2); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .sender-name { font-weight: 700; font-size: 13px; }
        .sender-date { font-size: 11px; color: #94a3b8; }
        .report-actions { display: flex; gap: 8px; }
        .btn-view { background: rgba(13,148,136,0.08); color: #0d9488; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; }
        .report-content { margin-top: 16px; background: #f9fefd; border: 1px solid #ccf2ee; border-radius: 10px; padding: 16px; }
        .report-content pre { font-family: monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.6; margin: 0; }
        
        /* Price Cards */
        .price-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
        @media (max-width: 640px) { .price-cards { grid-template-columns: 1fr; } }
        .price-card-min, .price-card-avg, .price-card-max { border-radius: 16px; padding: 20px; text-align: center; }
        .price-card-min { background: #f0fdf4; border: 2px solid #86efac; }
        .price-card-avg { background: #eff6ff; border: 2px solid #93c5fd; }
        .price-card-max { background: #fef3c7; border: 2px solid #fcd34d; }
        .price-card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
        .price-card-value { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
        .price-card-sub { font-size: 12px; color: #4d7c77; }
        
        /* Price Text Colors */
        .price-text { font-weight: 700; }
        .price-min { color: #ef4444; font-weight: 600; }
        .price-avg { color: #0891b2; font-weight: 600; }
        .price-max { color: #f59e0b; font-weight: 600; }
        .price-positive { color: #16a34a; font-weight: 600; }
        .price-negative { color: #ef4444; font-weight: 600; }
        .text-muted { color: #94a3b8; font-style: italic; }
        .mono-text { font-family: monospace; font-size: 12px; }
        .date-text { font-size: 12px; color: #4d7c77; }
        
        /* Badges */
        .badge-pending { background: #f59e0b; border-radius: 50px; padding: 2px 10px; font-size: 11px; font-weight: 800; margin-left: 8px; }
        .badge-new { background: #0d9488; color: white; border-radius: 50px; padding: 2px 8px; font-size: 10px; font-weight: 700; margin-left: 8px; }
        .badge-positive { background: rgba(22,163,74,0.1); color: #16a34a; padding: 3px 10px; border-radius: 40px; font-size: 12px; font-weight: 700; }
        .badge-negative { background: rgba(239,68,68,0.1); color: #ef4444; padding: 3px 10px; border-radius: 40px; font-size: 12px; font-weight: 700; }
        .badge-neutral { background: rgba(8,145,178,0.1); color: #0891b2; padding: 3px 10px; border-radius: 40px; font-size: 12px; font-weight: 700; }
        
        /* Toggle Switch */
        .toggles-list { display: flex; flex-direction: column; gap: 12px; }
        .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f9fefd; border: 1px solid #ccf2ee; border-radius: 12px; }
        .toggle-label { font-weight: 700; font-size: 13px; text-transform: capitalize; }
        .toggle-desc { font-size: 11px; color: #4d7c77; margin-top: 2px; }
        .toggle-switch { position: relative; display: inline-block; width: 48px; height: 24px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #94a3b8; transition: 0.3s; border-radius: 24px; }
        .toggle-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; }
        input:checked + .toggle-slider { background-color: #0d9488; }
        input:checked + .toggle-slider:before { transform: translateX(24px); }
        
        /* Info Box */
        .info-box { background: #f0fdfa; border-radius: 12px; padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
        
        /* Settings */
        .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .settings-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
        
        /* Info Grid */
        .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 12px; }
        .info-card { background: #f0fdfa; border: 1px solid #ccf2ee; border-radius: 10px; padding: 12px; }
        .info-label { font-size: 10px; font-weight: 700; color: #4d7c77; text-transform: uppercase; margin-bottom: 4px; }
        .info-value { font-size: 13px; font-weight: 600; word-break: break-word; }
        
        .section-pending, .section-approved { padding: 0 20px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 14px 0 8px; display: flex; align-items: center; gap: 6px; }
        .pending-title { color: #f59e0b; }
        .section-subtitle { font-size: 11px; font-weight: 700; color: #4d7c77; text-transform: uppercase; margin-bottom: 12px; }
        
        .full-width { width: 100%; justify-content: center; }
        .role-chip { padding: 3px 10px; border-radius: 40px; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-block; }
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .user-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; flex-shrink: 0; }
        .user-email { font-size: 10px; color: #94a3b8; display: block; margin-top: 2px; }
        .user-dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1.5px solid #ccf2ee; border-radius: 12px; z-index: 100; max-height: 180px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .user-dropdown-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f0fdfa; }
        .user-dropdown-item:hover { background: #f0fdfa; }
        .user-search-wrapper { position: relative; }
        .phone-input-wrapper { display: flex; align-items: stretch; border: 1.5px solid #ccf2ee; border-radius: 10px; overflow: hidden; background: #f0fdfa; }
        .phone-prefix { display: flex; align-items: center; padding: 0 12px; font-size: 13px; font-weight: 700; color: #0d9488; background: #f0fdfa; }
        .phone-input { flex: 1; padding: 10px 12px; font-size: 13px; border: none; background: transparent; outline: none; }
        .rejection-reason { font-size: 10px; color: #ef4444; margin-top: 2px; }
        
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
      `}</style>
      
      <ToastContainer alerts={alerts} removeAlert={removeAlert} />
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
      
      {logoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-confirm">
            <div className="modal-confirm-header"><div className="modal-confirm-title">Sign Out?</div><button onClick={() => setLogoutConfirm(false)} className="modal-close-btn">×</button></div>
            <div className="modal-confirm-message">You will be redirected to the home page.</div>
            <div className="modal-confirm-actions"><button onClick={doLogout} className="modal-confirm-btn" style={{ background: '#ef4444' }}>Yes, Sign Out</button></div>
          </div>
        </div>
      )}
      
      <div className="shell">
        <div className="topbar">
          <div className="topbar-brand"><div className="topbar-brand-acronym">LPES</div><div className="topbar-brand-tagline">Land Price Estimation System</div></div>
          <button className="topbar-expand-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><Ic.Menu /></button>
          <div className="topbar-title">A Machine Learning-Based Framework for Land Price Estimation</div>
          <div className="topbar-user" onClick={() => setUserMenuOpen(!userMenuOpen)} ref={userMenuRef}>
            <div className="topbar-user-avatar">{profilePhoto ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials}</div>
            <span className="topbar-user-name">{user?.name}</span>
            <span className="topbar-role">| Admin</span>
            <Ic.ChevDown />
          </div>
          {userMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 16, background: 'white', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', width: 260, zIndex: 1000, overflow: 'hidden' }}>
              <div style={{ padding: 16, textAlign: 'center', borderBottom: '1px solid #ccf2ee' }}>
                <div style={{ width: 60, height: 60, margin: '0 auto 10px', borderRadius: '50%', background: 'linear-gradient(135deg,#0d9488,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }} onClick={() => photoInputRef.current?.click()}>
                  {profilePhoto ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <span style={{ fontSize: 22, fontWeight: 'bold', color: 'white' }}>{initials}</span>}
                  <div style={{ position: 'absolute', bottom: -4, right: -4, background: '#0d9488', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: '#0d9488', fontWeight: 700, marginTop: 2 }}>System Admin</div>
                {user?.email && <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 6 }}>{user.email}</div>}
              </div>
              <button onClick={() => { setUserMenuOpen(false); setLogoutConfirm(true); }} style={{ width: '100%', padding: 12, background: 'none', border: 'none', borderTop: '1px solid #ccf2ee', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ic.Logout /> Sign Out</button>
            </div>
          )}
        </div>
        
        <div className="shell-body">
          <Sidebar active={active} setActive={handleSetActive} sidebarOpen={sidebarOpen} suggestionBadge={suggestionCount > seenSuggCount} reportBadge={!reportsBadgeDismissed && unreadReports > seenReportCount} mutationBadge={pendingMutationsCount > 0 && pendingMutationsCount > seenMutationsCount} />
          <div className="main"><div className="content">{renderContent()}</div></div>
        </div>
      </div>
    </>
  );
}