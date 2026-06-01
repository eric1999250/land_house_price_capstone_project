// ============================================================
// BUYER/SELLER DASHBOARD — pages/dashboard/buyer.js
// UPDATED: Profile photo upload + Bell click panel (left-aligned)
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
    if (u.role !== 'buyer_seller') {
      const map = {
        system_admin: '/dashboard/admin',
        district_land_officer: '/dashboard/district',
        sector_land_officer: '/dashboard/sector',
        notary: '/dashboard/notary'
      };
      router.replace(map[u.role] || '/');
      return;
    }
    fetch(`${API}/auth/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: u.id })
    })
      .then(r => r.json())
      .then(d => setUser(d.success ? { ...u, phone: d.user.phone || d.user.phone_number || u.phone || u.phone_number || '' } : u))
      .catch(() => setUser(u));
  }, []);
  return { user };
}

const fmt = n => Math.round(n).toLocaleString('en-US') + ' RWF';
const fmtNum = (n, d = 2) => parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const calcTax = p => p > 5_000_000 ? (p - 5_000_000) * 0.025 : 0;

function validateNationalId(nid) {
  const id = nid.replace(/\s/g, '');
  if (id.length !== 16) return { ok: false, msg: 'National ID must be exactly 16 digits.' };
  if (!/^\d{16}$/.test(id)) return { ok: false, msg: 'National ID must contain digits only.' };
  if (id[0] !== '1') return { ok: false, msg: 'National ID must start with 1.' };
  const year = parseInt(id.slice(1, 5), 10);
  const currentYear = new Date().getFullYear();
  if (year < 1900) return { ok: false, msg: `No one born in ${year} would still be alive today.` };
  if (year > currentYear) return { ok: false, msg: `The year ${year} has not been reached yet.` };
  const sexCode = parseInt(id.slice(5, 8), 10);
  if (!(sexCode >= 700 && sexCode <= 799) && !(sexCode >= 800 && sexCode <= 899))
    return { ok: false, msg: `Sex code (${id.slice(5, 8)}) must be 7XX (female) or 8XX (male).` };
  return { ok: true, msg: '' };
}

function validatePhone(phone) {
  const p = phone.replace(/[\s\-]/g, '');
  const withCode = /^\+2507[0-9]{8}$/.test(p);
  const withZero = /^07[0-9]{8}$/.test(p);
  if (!withCode && !withZero)
    return { ok: false, msg: 'Phone must be +250 7XX XXX XXX or 07X XXX XXXX.' };
  const local = withCode ? p.slice(4) : p.slice(1);
  const prefix2 = local.slice(0, 2);
  if (!['72', '73', '78', '79'].includes(prefix2))
    return { ok: false, msg: 'Phone prefix must be 072/073 (TIGO) or 078/079 (MTN).' };
  return { ok: true, msg: '' };
}

function validateEmail(email) {
  const lower = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower)) return false;
  return [
    /^[^\s@]+@gmail\.com$/,
    /^[^\s@]+@yahoo\.[a-z.]{2,}$/,
    /^[^\s@]+@outlook\.com$/,
    /^[^\s@]+@hotmail\.com$/,
    /^[^\s@]+@icloud\.com$/,
    /^[^\s@]+@protonmail\.com$/,
    /^[^\s@]+@.*\.rw$/,
  ].some(p => p.test(lower));
}

// ── SVG Icons ──────────────────────────────────────────────
const Ic = {
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  Tag: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  Map: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" x2="9" y1="3" y2="18" /><line x1="15" x2="15" y1="6" y2="21" /></svg>,
  MyMap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  Shield: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Chat: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  MapPin: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  Info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  Logout: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>,
  Phone: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.49 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  Spin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>,
  Suggest: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  User: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Handshake: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" /></svg>,
  ChevDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Menu: () => (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9 L1 9 M1 9 L4 6 M1 9 L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="0" y="0" width="22" height="3.5" rx="1.5" fill="currentColor" />
      <rect x="10" y="7" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="10" y="9" width="12" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="14.5" width="22" height="3.5" rx="1.5" fill="currentColor" />
    </svg>
  ),
  Star: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  Upload: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  UploadZone: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  Notary: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>,
  History: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.9"/><line x1="12" y1="7" x2="12" y2="12"/><polyline points="12 12 15 14"/></svg>,
  Camera: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  MapDot: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

// ── NAV ──────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { id: 'predict', label: 'Predict Price', icon: 'Tag' },
  { id: 'history', label: 'Price History', icon: 'History' },
  { id: 'my-publications', label: 'My Publications', icon: 'MyMap' },
  { id: 'public-listings', label: 'All Publications', icon: 'Map' },
  { id: 'agreements', label: 'Agreements', icon: 'Handshake' },
  { id: 'mutations', label: 'My Mutations', icon: 'Shield' },
  { id: 'suggest', label: 'Suggestions', icon: 'Suggest' },
  { id: 'my-parcels', label: 'My Parcels', icon: 'MapDot' },
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
          <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, background: a.type === 'success' ? 'rgba(13,148,136,.1)' : a.type === 'error' ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)', color: a.type === 'success' ? '#0d9488' : a.type === 'error' ? '#ef4444' : '#f59e0b' }}>{a.type === 'success' ? '✓' : a.type === 'error' ? '✕' : '!'}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: '"Times New Roman",Times,serif', color: '#0c1a19' }}>{a.message}</span>
          <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ── Chatbot ────────────────────────────────────────────────
function Chatbot({ user }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ text: "Hi! I'm your assistant. How can I help?", isBot: true, id: 0 }]);
  const [inp, setInp] = useState('');
  const [typ, setTyp] = useState(false);
  const [rst, setRst] = useState(false);
  const sidRef = useRef('s_' + Date.now());
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typ]);

  async function send(m) {
    const text = (m || inp).trim();
    if (!text) return;
    setMsgs(p => [...p, { text, isBot: false, id: Date.now() + Math.random() }]);
    setInp(''); setTyp(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sidRef.current }),
      });
      const d = await res.json();
      setTyp(false);
      setMsgs(p => [...p, { text: d.response || '…', isBot: true, id: Date.now() + Math.random() }]);
    } catch {
      setTyp(false);
      setMsgs(p => [...p, { text: 'Sorry, could not connect.', isBot: true, id: Date.now() }]);
    }
  }

  function doReset() {
    setRst(false);
    fetch(`${API}/chat/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sidRef.current }) }).catch(() => {});
    sidRef.current = 's_' + Date.now();
    setMsgs([{ text: "Hi! I'm your assistant. How can I help?", isBot: true, id: Date.now() }]);
  }

  return (
    <>
      {/* ── Floating circle toggle button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg,#64748b,#475569)'
            : 'linear-gradient(135deg,#0d9488,#0891b2)',
          color: 'white', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 30px rgba(13,148,136,.20)',
          zIndex: 1000, transition: 'all .3s',
        }}
      >
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
        {/* AI badge — only when closed */}
        {!open && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#f59e0b', color: 'white',
            fontSize: 9, fontWeight: 800,
            padding: '2px 5px', borderRadius: 50,
            fontFamily: 'sans-serif',
          }}>AI</span>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24,
          width: 330, maxWidth: 'calc(100vw - 48px)',
          background: 'white', borderRadius: 22,
          boxShadow: '0 20px 50px rgba(13,148,136,.24)',
          border: '1px solid #ccf2ee',
          display: 'flex', flexDirection: 'column',
          height: 480, zIndex: 999,
          animation: 'fadeUp .3s ease',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#0d9488,#0891b2)',
            color: 'white', padding: '13px 15px',
            borderRadius: '22px 22px 0 0',
            display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, fontFamily: '"Times New Roman",Times,serif' }}>System Assistant</div>
              <div style={{ fontSize: 11, opacity: .8 }}>Ask me anything about LPES</div>
            </div>
            <button onClick={() => setRst(true)} title="Reset chat" style={{
              background: 'rgba(255,255,255,.2)', border: 'none', color: 'white',
              width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
              fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>↺</button>
          </div>

          {/* Reset confirm overlay */}
          {rst && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, borderRadius: 22,
            }}>
              <div style={{
                background: 'white', borderRadius: 14, padding: '20px 18px',
                width: 230, textAlign: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, fontFamily: '"Times New Roman",Times,serif' }}>Start New Chat?</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginBottom: 16 }}>This will clear the conversation history.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setRst(false)} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: '1.5px solid #ccf2ee', background: 'white',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    fontFamily: '"Times New Roman",Times,serif', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#0c1a19'; }}
                  >Cancel</button>
                  <button onClick={doReset} style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    border: '1.5px solid #0d9488', background: 'white',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    fontFamily: '"Times New Roman",Times,serif', transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#0c1a19'; }}
                  >Yes, Reset</button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '13px',
            display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            {msgs.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: m.isBot ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '85%', padding: '9px 12px', fontSize: 13, lineHeight: 1.5,
                  borderRadius: m.isBot ? '3px 14px 14px 14px' : '14px 3px 14px 14px',
                  background: m.isBot ? '#f0fdfa' : 'linear-gradient(135deg,#0d9488,#0891b2)',
                  color: m.isBot ? '#0c1a19' : 'white',
                  fontFamily: '"Times New Roman",Times,serif',
                  wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                }} dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {typ && (
              <div style={{ display: 'flex' }}>
                <div style={{
                  background: '#f0fdfa', padding: '11px 15px',
                  borderRadius: '3px 14px 14px 14px',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, .2, .4].map((d, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#0d9488',
                      display: 'inline-block', animation: `bounce .9s ${d}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: 7, padding: '9px 11px',
            borderTop: '1px solid #ccf2ee', flexShrink: 0,
          }}>
            <input
              value={inp}
              onChange={e => setInp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message…"
              style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
                border: '1.5px solid #ccf2ee', borderRadius: 50,
                outline: 'none', fontFamily: '"Times New Roman",Times,serif',
                background: '#f0fdfa',
              }}
            />
            <button onClick={() => send()} disabled={!inp.trim()} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg,#0d9488,#0891b2)',
              border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, opacity: inp.trim() ? 1 : .5,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sidebar ────────────────────────────────────────────────
function Sidebar({ active, setActive, sidebarOpen, user }) {
  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{ position: 'relative' }}>
      <nav className="sb-nav" style={{ flex: 1 }}>
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
      {/* Chatbot removed from here */}
    </aside>
  );
}

// ── Dashboard ──────────────────────────────────────────────
function ViewDashboard({ setActive, stats }) {
  return (
    <div className="view">
      <div className="stats-grid">
        {[
          { label: 'My Publications', value: stats.listings || 0, color: '#0d9488', sub: 'active listings', clickable: true, target: 'my-publications' },
          { label: 'Active Mutations', value: stats.mutations || 0, color: '#0891b2', sub: 'in progress', clickable: true, target: 'mutations' },
          { label: 'Approved Deals', value: stats.approved || 0, color: '#22c55e', sub: 'completed', clickable: true, target: 'agreements' },
          { label: 'Price Estimates', value: stats.estimates || 0, color: '#f59e0b', sub: 'predictions made', clickable: true, target: 'history' },
          { label: 'My Parcels', value: stats.parcels || 0, color: '#0d9488', sub: 'owned land parcels', clickable: true, target: 'my-parcels' },
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
          { label: 'Predict Price', desc: 'Estimate land value using ML model', id: 'predict', color: '#f59e0b' },
          { label: 'Price History', desc: 'View all your past estimations', id: 'history', color: '#0d9488' },
          { label: 'My Publications', desc: 'Manage your listed parcels', id: 'my-publications', color: '#0891b2' },
          { label: 'All Publications', desc: "Browse other sellers' parcels", id: 'public-listings', color: '#0891b2' },
          { label: 'Agreements', desc: 'View & manage land agreements', id: 'agreements', color: '#7c3aed' },
          { label: 'My Mutations', desc: 'Track your active land transfers', id: 'mutations', color: '#8b5cf6' },
          { label: 'My Parcels', desc: 'View your owned land parcels', id: 'my-parcels', color: '#0d9488' },
          { label: 'Suggestions', desc: 'Share feedback with admin', id: 'suggest', color: '#0891b2' },
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

// ── Predict Price ──────────────────────────────────────────
function ViewPredict({ user, addAlert }) {
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [predLoad, setPredLoad] = useState(false);
  const [landData, setLandData] = useState(null);
  const [preds, setPreds] = useState(null);
  const [err, setErr] = useState('');
  const [predErr, setPredErr] = useState('');
  const resRef = useRef(null);
  const predRef = useRef(null);

  async function doSearch() {
    if (!upi.trim()) { setErr('Please enter a UPI'); return; }
    setErr(''); setLoading(true); setPreds(null); setLandData(null);
    try {
      const d = await (await fetch(`${API}/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: upi.trim() }) })).json();
      setLoading(false);
      if (d.success) { setLandData(d.data); setTimeout(() => resRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
      else setErr(d.message || 'UPI not found');
    } catch { setLoading(false); setErr('Cannot connect to server'); }
  }

  async function doPredict() {
    if (!landData) { setPredErr('Please search for a UPI first'); return; }
    setPredErr(''); setPredLoad(true); setPreds(null);
    try {
      const d = await (await fetch(`${API}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: landData.UPI, user_id: user?.id }) })).json();
      setPredLoad(false);
      if (d.success) { setPreds(d); addAlert(`Price estimation completed for ${landData.UPI}`, 'success'); setTimeout(() => predRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
      else setPredErr(d.message || 'Prediction failed');
    } catch { setPredLoad(false); setPredErr('Cannot connect to server'); }
  }

  function calcTaxNode(price) {
    if (price <= 5000000) return <span className="no-tax">&#10003; No Tax (below 5M RWF)</span>;
    const tax = (price - 5000000) * 0.025;
    return <span>Tax: <strong>{fmt(tax)}</strong> (2.5%)</span>;
  }

  return (
    <div className="view">
      <div className="tax-notice">
        <span className="tn-icon"><Ic.Info /></span>
        <span>A Machine Learning-Based Framework for Land Price Estimation</span>
      </div>
      <div className="card">
        <div className="card-hd"><Ic.Search /> Search Land Parcel by UPI</div>
        <div className="s-row">
          <input className="s-inp" value={upi} onChange={e => setUpi(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="e.g. xx/xx/xx/xx/xxxx" />
          <button className="btn-p" onClick={doSearch} disabled={loading}>
            <Ic.Search /> {loading ? <><Ic.Spin /> …</> : 'Search'}
          </button>
        </div>
        <div className="s-hint"><Ic.Info /> Use Unique Parcel Identifier</div>
        {err && <div className="alert-e">{err}</div>}
      </div>
      {landData && (
        <div className="card" ref={resRef}>
          <div className="card-hd">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Tag /> Land Data</span>
            <span className="upi-bdg">UPI: {landData.UPI}</span>
          </div>
          <div className="d-grid">
            <div className="d-sec">
              <div className="d-sec-title"><Ic.Info /> Basic Information</div>
              <div className="d-cols">
                <DataField label="Province" value={landData.Province} />
                <DataField label="District" value={landData.District} />
                <DataField label="Sector" value={landData.Sector} />
                <DataField label="Cell" value={landData.Cell} />
              </div>
              <DataField label="Village" value={landData.Village} />
            </div>
            <div className="d-sec">
              <div className="d-sec-title"><Ic.MapPin /> Location & Area</div>
              <div className="d-cols">
                <DataField label="X Coordinate" value={fmtNum(landData.X_coordinate, 4)} />
                <DataField label="Y Coordinate" value={fmtNum(landData.Y_coordinate, 4)} />
              </div>
              <DataField label="Area (m²)" value={fmtNum(landData.Area, 2) + ' m²'} />
            </div>
            <div className="d-sec">
              <div className="d-sec-title"><Ic.Tag /> Zoning & Classification</div>
              <div className="d-cols">
                <DataField label="Zoning" value={landData.Zoning} />
                <DataField label="Zoning %" value={fmtNum(landData['Zoning_%'], 2) + '%'} />
                <DataField label="Settlement" value={landData.Settlement} />
                <DataField label="Settlement %" value={fmtNum(landData['Settlement_%'], 2) + '%'} />
              </div>
              <DataField label="Land Use" value={landData.Land_use} />
            </div>
            <div className="d-sec">
              <div className="d-sec-title"><Ic.Chart /> Market Values (RWF)</div>
              <DataField label="Min / m²" value={fmtNum(landData.Min_Value_Sqm, 0) + ' RWF'} />
              <DataField label="Avg / m²" value={fmtNum(landData.Avg_Value_Sqm, 0) + ' RWF'} />
              <DataField label="Max / m²" value={fmtNum(landData.Max_Value_Sqm, 0) + ' RWF'} />
            </div>
          </div>
          <button className="btn-pred" onClick={doPredict} disabled={predLoad}>
            <Ic.Chart /> {predLoad ? <><Ic.Spin /> Processing…</> : 'Estimate Land Price'}
          </button>
          {predErr && <div className="alert-e">{predErr}</div>}
        </div>
      )}
      {preds && (
        <div className="card" ref={predRef}>
          <div className="card-hd"><Ic.Chart /> Estimated Land Price</div>
          <div className="pred-info"><Ic.Info /> Estimated Prices: Minimum, Average and Maximum</div>
          <div className="p-grid">
            {[
              { type: 'minimum', label: 'Minimum', price: preds.min_price, sqm: preds.min_per_sqm },
              { type: 'average', label: 'Average', price: preds.avg_price, sqm: preds.avg_per_sqm },
              { type: 'maximum', label: 'Maximum', price: preds.max_price, sqm: preds.max_per_sqm },
            ].map(pc => (
              <div key={pc.type} className={`price-card ${pc.type}`}>
                <div className="price-label">{pc.label}</div>
                <div className="price-total">{fmt(pc.price)}</div>
                <div className="price-sqm">{fmtNum(pc.sqm)} RWF/m²</div>
                <div className="price-tax">{calcTaxNode(pc.price)}</div>
              </div>
            ))}
          </div>
          <div className="model-note"><Ic.Info /> A 2.5% Tax Applies Only to the Price Above 5,000,000 RWF</div>
        </div>
      )}
    </div>
  );
}

function DataField({ label, value }) {
  return (
    <div className="data-field">
      <div className="data-label">{label}</div>
      <div className="data-value">{value || '—'}</div>
    </div>
  );
}

// ── My Parcels (Owned Land) ──
function ViewMyParcels({ user, addAlert }) {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedParcel, setSelectedParcel] = useState(null); // For expanded view

  useEffect(() => {
    fetch(`${API}/user/parcels`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ user_id: user?.id }) 
    })
      .then(r => r.json())
      .then(d => { 
        if (d.success) {
          console.log('Parcels data:', d.parcels); // Debug log
          setParcels(d.parcels || []);
        }
      })
      .catch(() => addAlert('Failed to load parcels', 'error'))
      .finally(() => setLoading(false));
  }, [user]);

  // Helper to get area value
  const getArea = (p) => {
    // Try different possible field names
    return p.area_in_meter_square || p.area_m2 || p.area || p.Area || 0;
  };

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.MapPin /> My Owned Parcels ({parcels.length})
          </span>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && parcels.length === 0 && (
          <div className="empty-state">
            You don't own any land parcels yet.<br />
            <span style={{ fontSize: 12, color: '#4d7c77' }}>
              When you buy land and admin confirms, it will appear here.
            </span>
          </div>
        )}
        {!loading && parcels.map(p => (
          <div key={p.upi || p.id} className="listing-row" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }} onClick={() => setSelectedParcel(selectedParcel === p.upi ? null : p.upi)}>
            {/* Main row - always visible */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="listing-upi teal" style={{ fontSize: 14, fontWeight: 800 }}>{p.upi}</div>
                
                {/* Province · District · Sector - Now always visible */}
                <div style={{ fontSize: 13, color: '#0d9488', fontWeight: 600, marginTop: 6 }}>
                  Province: {p.province || '—'} · District: {p.district || '—'} · Sector: {p.sector || '—'}
                </div>
                
                {/* Area and Land Use */}
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12 }}>
                  <span>Area: <strong>{Number(getArea(p)).toLocaleString()} m²</strong></span>
                  <span>Land Use: <strong>{p.land_use || '—'}</strong></span>
                  {p.acquired_at && (
                    <span style={{ color: '#0d9488' }}>Acquired: {fmtDate(p.acquired_at)}</span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ 
                  fontSize: 11, fontWeight: 700, color: '#0d9488', 
                  background: 'rgba(13,148,136,.1)', padding: '4px 10px', borderRadius: 50 
                }}>
                  Owned
                </span>
              </div>
            </div>
            
            {/* Expanded details - shows only when selected */}
            {selectedParcel === p.upi && (
              <div style={{ 
                marginTop: 12, 
                paddingTop: 12, 
                borderTop: '1px solid var(--g200)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
                fontSize: 12
              }}>
                {p.cell && (
                  <div>
                    <span style={{ color: '#4d7c77', fontWeight: 600 }}>Cell:</span>{' '}
                    <span style={{ fontWeight: 500 }}>{p.cell}</span>
                  </div>
                )}
                {p.village && (
                  <div>
                    <span style={{ color: '#4d7c77', fontWeight: 600 }}>Village:</span>{' '}
                    <span style={{ fontWeight: 500 }}>{p.village}</span>
                  </div>
                )}
                {p.zoning && (
                  <div>
                    <span style={{ color: '#4d7c77', fontWeight: 600 }}>Zoning:</span>{' '}
                    <span style={{ fontWeight: 500 }}>{p.zoning}</span>
                    {p.zoning_percentage && ` (${p.zoning_percentage}%)`}
                  </div>
                )}
                {p.sentlement && (
                  <div>
                    <span style={{ color: '#4d7c77', fontWeight: 600 }}>Settlement:</span>{' '}
                    <span style={{ fontWeight: 500 }}>{p.sentlement}</span>
                    {p.sentlement_percentage && ` (${p.sentlement_percentage}%)`}
                  </div>
                )}
                
                {/* Note about price history instead of the button */}
                <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: '10px 12px', background: 'rgba(13,148,136,.05)', borderRadius: 8, borderLeft: '3px solid #0d9488' }}>
                  <span style={{ fontSize: 12, color: '#4d7c77' }}>
                    <Ic.Info style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                      For more details, go to <strong style={{ color: '#0d9488', cursor: 'pointer' }} onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to price history - you can add this functionality
                      window.dispatchEvent(new CustomEvent('viewPriceHistory', { detail: { upi: p.upi } }));
                    }}>Price History</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Price History ──────────────────────────────────────────
function ViewHistory({ user, addAlert }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) setHistory(d.history || []); })
      .catch(() => addAlert('Could not load history', 'error'))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = history.filter(h =>
    !search ||
    (h.upi || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.district || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.sector || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.History /> Price Estimation History ({filtered.length})
          </span>
          <div className="search-wrap-inline">
            <Ic.Search />
            <input className="s-inp-sm" placeholder="Search UPI, district…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="info-banner" style={{ margin: '12px 20px 4px' }}>
          <Ic.Info />
          <span>Each UPI is stored only once. Re-predicting the same UPI updates the prices instead of creating a duplicate.</span>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading history…</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            No prediction history yet.<br />
            <span style={{ fontSize: 12, color: '#4d7c77', display: 'block', marginTop: 6 }}>
              Use the <strong>Predict Price</strong> tab to estimate land values.
            </span>
          </div>
        )}
        {!loading && filtered.map((h, i) => (
          <div key={h.id || i} style={{ borderTop: '1px solid var(--g200)', padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 14 }}>{h.upi}</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 2 }}>
                  {[h.sector, h.district, h.province].filter(Boolean).join(' · ')}
                  {h.land_use ? ` · ${h.land_use}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(h.created_at)}</div>
                {h.area_m2 ? <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 1 }}>{fmtNum(h.area_m2, 0)} m²</div> : null}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Minimum', total: h.min_price, sqm: h.min_per_sqm, tax: h.tax_min, cls: 'minimum' },
                { label: 'Average', total: h.avg_price, sqm: h.avg_per_sqm, tax: h.tax_avg, cls: 'average' },
                { label: 'Maximum', total: h.max_price, sqm: h.max_per_sqm, tax: h.tax_max, cls: 'maximum' },
              ].map(pc => (
                <div key={pc.label} className={`price-card ${pc.cls}`} style={{ padding: '10px 12px' }}>
                  <div className="price-label">{pc.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0c1a19', margin: '3px 0' }}>{fmt(pc.total || 0)}</div>
                  <div style={{ fontSize: 11, color: '#4d7c77' }}>{fmtNum(pc.sqm || 0, 0)} RWF/m²</div>
                  {pc.tax > 0
                    ? <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3, fontWeight: 600 }}>Tax: {fmt(pc.tax)}</div>
                    : <div style={{ fontSize: 10, color: '#10b981', marginTop: 3, fontWeight: 600 }}>No tax</div>}
                </div>
              ))}
            </div>
          </div>
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
      <div className="upload-zone" onClick={() => inputRef.current?.click()}
        style={{ borderColor: file ? '#0d9488' : undefined, background: file ? 'rgba(13,148,136,.04)' : undefined }}>
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0d9488' }}>{file.name}</span>
            <button onClick={e => { e.stopPropagation(); setUploads(p => ({ ...p, [fieldKey]: null })); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: '#0d9488' }}><Ic.UploadZone /></div>
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

// ── Sale Form ──────────────────────────────────────────────
function ViewSaleForm({ user, agreement, addAlert, onFormSubmitted, onBack }) {
  const [saving, setSaving] = useState(false);
  const [married, setMarried] = useState('no');
  const [searchingUpi, setSearchingUpi] = useState(false);
  const [uploads, setUploads] = useState({ seller_id: null, spouse_id: null, buyer_id: null, land_title: null, civil_cert_seller: null, civil_cert_buyer: null });
  const [form, setForm] = useState({
    seller_name: user?.name || '', seller_national_id: '', seller_district: '', seller_sector: '', seller_cell: '', seller_village: '',
    seller_phone: user?.phone ? user.phone.replace(/^\+250/, '').replace(/^0/, '') : '', seller_email: '', buyer_phone: '', upi: agreement?.upi || '', province: '', district: '', sector: '', cell: '', village: '',
    percentage: '100', motivation: '', spouse_name: '', spouse_national_id: '', buyer_name: agreement?.buyer_name || '',
    buyer_national_id: '', buyer_district: '', buyer_sector: '', buyer_cell: '', buyer_village: '',
    agreed_price: agreement?.agreed_price || '', land_value: '', development_value: '0',
  });
  
  const h = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  
  // Checklist - ALWAYS CHECKED (cannot be unchecked)
  const checklist = {
    doc_identity: true,
    doc_civil_status: true,
    doc_land_title: true
  };

  // Search UPI and auto-fill parcel details
  async function searchUpi(upiValue) {
    if (!upiValue || upiValue.length < 10) return;
    setSearchingUpi(true);
    try {
      const response = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi: upiValue.trim() })
      });
      const data = await response.json();
      if (data.success && data.data) {
        const land = data.data;
        setForm(f => ({
          ...f,
          province: land.Province || '',
          district: land.District || '',
          sector: land.Sector || '',
          cell: land.Cell || '',
          village: land.Village || '',
        }));
        addAlert('Parcel details loaded successfully!', 'success');
      } else {
        // Clear auto-filled fields if UPI not found
        setForm(f => ({
          ...f,
          province: '', district: '', sector: '', cell: '', village: '',
        }));
        if (upiValue.trim()) {
          addAlert('UPI not found. Please check the UPI or enter details manually.', 'warning');
        }
      }
    } catch (error) {
      console.error('Error searching UPI:', error);
    } finally {
      setSearchingUpi(false);
    }
  }

  // Handle UPI input with debounced search
  const upiDebounceRef = useRef(null);
  function handleUpiChange(value) {
    setForm(f => ({ ...f, upi: value }));
    if (upiDebounceRef.current) clearTimeout(upiDebounceRef.current);
    upiDebounceRef.current = setTimeout(() => searchUpi(value), 800);
  }

  async function submit() {
    // Form validation - ALL FIELDS REQUIRED
    if (!form.seller_name.trim()) { addAlert('Seller Full Name is required', 'error'); return; }
    if (!form.seller_national_id.trim()) { addAlert('Seller National ID is required', 'error'); return; }
    const sellerIdCheck = validateNationalId(form.seller_national_id);
    if (!sellerIdCheck.ok) { addAlert(`Seller ID: ${sellerIdCheck.msg}`, 'error'); return; }
    if (!form.seller_district.trim()) { addAlert('Seller District is required', 'error'); return; }
    if (!form.seller_sector.trim()) { addAlert('Seller Sector is required', 'error'); return; }
    if (!form.seller_cell.trim()) { addAlert('Seller Cell is required', 'error'); return; }
    if (!form.seller_village.trim()) { addAlert('Seller Village is required', 'error'); return; }
    if (!form.seller_phone.trim()) { addAlert('Seller Phone is required', 'error'); return; }
    const phoneCheck = validatePhone('+250' + form.seller_phone);
    if (!phoneCheck.ok) { addAlert(`Seller Phone: ${phoneCheck.msg}`, 'error'); return; }
    if (!form.seller_email.trim()) { addAlert('Seller Email is required', 'error'); return; }
    if (!validateEmail(form.seller_email)) { addAlert('Seller Email must be Gmail, Yahoo, Outlook, or a .rw address', 'error'); return; }
    if (!form.buyer_phone.trim()) { addAlert('Buyer Phone is required', 'error'); return; }
    const buyerPhoneCheck = validatePhone('+250' + form.buyer_phone);
    if (!buyerPhoneCheck.ok) { addAlert(`Buyer Phone: ${buyerPhoneCheck.msg}`, 'error'); return; }
    
    if (married === 'yes') {
      if (!form.spouse_name.trim()) { addAlert('Spouse Full Name is required', 'error'); return; }
      if (!form.spouse_national_id.trim()) { addAlert('Spouse National ID is required', 'error'); return; }
      const spouseCheck = validateNationalId(form.spouse_national_id);
      if (!spouseCheck.ok) { addAlert(`Spouse ID: ${spouseCheck.msg}`, 'error'); return; }
    }
    
    if (!form.upi.trim()) { addAlert('UPI is required', 'error'); return; }
    if (!form.province.trim()) { addAlert('Province is required - search UPI first or enter manually', 'error'); return; }
    if (!form.district.trim()) { addAlert('District is required - search UPI first or enter manually', 'error'); return; }
    if (!form.sector.trim()) { addAlert('Sector is required - search UPI first or enter manually', 'error'); return; }
    if (!form.cell.trim()) { addAlert('Cell is required - search UPI first or enter manually', 'error'); return; }
    if (!form.village.trim()) { addAlert('Village is required - search UPI first or enter manually', 'error'); return; }
    
    if (!form.buyer_name.trim()) { addAlert('Buyer name is required', 'error'); return; }
    if (!form.buyer_national_id.trim()) { addAlert('Buyer National ID is required', 'error'); return; }
    const buyerIdCheck = validateNationalId(form.buyer_national_id);
    if (!buyerIdCheck.ok) { addAlert(`Buyer ID: ${buyerIdCheck.msg}`, 'error'); return; }
    if (!form.buyer_district.trim()) { addAlert('Buyer District is required', 'error'); return; }
    if (!form.buyer_sector.trim()) { addAlert('Buyer Sector is required', 'error'); return; }
    if (!form.buyer_cell.trim()) { addAlert('Buyer Cell is required', 'error'); return; }
    if (!form.buyer_village.trim()) { addAlert('Buyer Village is required', 'error'); return; }
    
    if (!form.agreed_price) { addAlert('Agreed price is required', 'error'); return; }
    if (!form.land_value) { addAlert('Value of Land is required', 'error'); return; }
    if (!form.percentage) { addAlert('Percentage of Rights to Transfer is required', 'error'); return; }

    // Check ALL required uploads
    if (!uploads.seller_id) { addAlert('Please upload Seller National ID document', 'error'); return; }
    if (!uploads.buyer_id) { addAlert('Please upload Buyer National ID document', 'error'); return; }
    if (!uploads.land_title) { addAlert('Please upload Land Title document', 'error'); return; }
    if (!uploads.civil_cert_seller) { addAlert('Please upload Civil Status Certificate for Seller', 'error'); return; }
    if (!uploads.civil_cert_buyer) { addAlert('Please upload Civil Status Certificate for Buyer', 'error'); return; }
    if (married === 'yes' && !uploads.spouse_id) { addAlert('Please upload Spouse National ID document', 'error'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('agreement_id', agreement?.id); 
      fd.append('listing_id', agreement?.listing_id);
      fd.append('seller_id_user', user?.id); 
      fd.append('buyer_id_user', agreement?.buyer_id);
      fd.append('form_data', JSON.stringify({ 
        ...form, 
        seller_phone: form.seller_phone ? '+250' + form.seller_phone : '',
        buyer_phone: form.buyer_phone ? '+250' + form.buyer_phone : '',
        married, 
        checklist 
      }));
      Object.entries(uploads).forEach(([k, v]) => { if (v) fd.append(k, v); });
      const r = await fetch(`${API}/sale-form/submit`, { method: 'POST', body: fd });
      const d = await r.json();
      if (d.success) { 
        addAlert('Form 11a + 11b submitted! Now select a notary.', 'success'); 
        onFormSubmitted({ 
          ...agreement, 
          form_id: d.form_id, 
          form_ref: d.form_ref,
          sector: form.sector  // ← Add the sector from the filled form!
        }); 
      } else {
        addAlert(d.message || 'Submission failed', 'error');
      }
    } catch { 
      addAlert('Cannot connect to server', 'error'); 
    }
    setSaving(false);
  }

  const sectionTitle = (label) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.5px', padding: '14px 20px 8px', borderTop: '1px solid var(--g200)', marginTop: 4 }}>{label}</div>
  );

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.FileText /> Official Sale Form — Form 11.a &amp; 11.b</span>
          <button onClick={onBack} className="btn-back-small">← Back</button>
        </div>
        <div className="info-banner" style={{ margin: '12px 20px' }}>
          <Ic.Info />
          <div>
            <strong>FORM 11.a</strong> — Application for Transfer of Rights by Voluntary Sale<br />
            <strong>FORM 11.b</strong> — Land Transfer Contract (V.05 Edition January 2023, Rwanda Land Administration)<br />
            <span style={{ color: '#4d7c77', fontSize: 12 }}>Fill this form before selecting a notary. The notary will stamp and certify it.</span>
          </div>
        </div>
        <div style={{ margin: '0 20px 14px', padding: '12px 16px', background: 'var(--teal-l)', borderRadius: 12, border: '1px solid var(--g200)', fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#0d9488' }}>Agreement Reference</div>
          <div>UPI: <strong style={{ fontFamily: 'monospace' }}>{agreement?.upi}</strong></div>
          <div>Agreed Price: <strong>{fmt(agreement?.agreed_price || 0)}</strong> &nbsp;|&nbsp; Tax: <strong>{fmt(calcTax(agreement?.agreed_price || 0))}</strong></div>
          <div>Buyer: <strong>{agreement?.buyer_name}</strong> &nbsp;|&nbsp; Seller: <strong>{agreement?.seller_name}</strong></div>
        </div>
        
        {sectionTitle('FORM 11.a — Seller (Applicant) Information')}
        <div style={{ padding: '0 20px 6px' }}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Seller Full Name *</label><input className="f-inp" name="seller_name" value={form.seller_name} onChange={h} placeholder="Full name as on ID" /></div>
            <div className="form-group">
              <label className="form-label">National ID / Passport *</label>
              <input className="f-inp" name="seller_national_id" value={form.seller_national_id} onChange={h} placeholder="16-digit ID number" maxLength={16} style={{ fontFamily: 'monospace' }} />
              {form.seller_national_id && (() => { if (form.seller_national_id.length < 16) return <span style={{ fontSize: 11, color: '#4d7c77' }}>{16 - form.seller_national_id.length} digits remaining</span>; const r = validateNationalId(form.seller_national_id); if (!r.ok) return <span style={{ fontSize: 11, color: '#ef4444' }}>{r.msg}</span>; return <span style={{ fontSize: 11, color: '#10b981' }}>✓ Valid ID</span>; })()}
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">District *</label><input className="f-inp" name="seller_district" value={form.seller_district} onChange={h} placeholder="e.g. Huye" /></div>
            <div className="form-group"><label className="form-label">Sector *</label><input className="f-inp" name="seller_sector" value={form.seller_sector} onChange={h} placeholder="e.g. Mbazi" /></div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Cell *</label><input className="f-inp" name="seller_cell" value={form.seller_cell} onChange={h} placeholder="e.g. Cyarumbo" /></div>
            <div className="form-group"><label className="form-label">Village *</label><input className="f-inp" name="seller_village" value={form.seller_village} onChange={h} placeholder="e.g. Karama" /></div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Seller Telephone *</label>
              <div style={{ display:'flex', alignItems:'stretch', border:'1.5px solid var(--g200)', borderRadius:'var(--rl)', overflow:'hidden', background:'var(--teal-l)', transition:'border-color .22s,box-shadow .22s' }}
                onFocusCapture={e => { e.currentTarget.style.borderColor='var(--teal)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(13,148,136,.1)'; e.currentTarget.style.background='white'; }}
                onBlurCapture={e => { e.currentTarget.style.borderColor='var(--g200)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='var(--teal-l)'; }}>
                <span style={{ display:'flex', alignItems:'center', padding:'0 10px 0 13px', fontSize:13, fontWeight:700, color:'var(--teal)', whiteSpace:'nowrap', userSelect:'none' }}>+250</span>
                <input
                  style={{ flex:1, padding:'10px 13px', fontSize:13, fontFamily:'"Times New Roman",Times,serif', background:'transparent', border:'none', outline:'none', color:'var(--dark)', minWidth:0 }}
                  name="seller_phone"
                  type="text"
                  inputMode="numeric"
                  placeholder="7XXXXXXXXX"
                  value={form.seller_phone}
                  maxLength={9}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setForm(f => ({ ...f, seller_phone: digits }));
                  }}
                />
              </div>
              {form.seller_phone && (() => {
                if (form.seller_phone.length < 9) return <span style={{ fontSize:11, color:'#f59e0b' }}>⚠ {9 - form.seller_phone.length} digits remaining</span>;
                if (form.seller_phone[0] !== '7') return <span style={{ fontSize:11, color:'#ef4444' }}>Must start with 7</span>;
                if (!['72','73','78','79'].includes(form.seller_phone.slice(0,2))) return <span style={{ fontSize:11, color:'#ef4444' }}>Prefix must be 72/73 (TIGO) or 78/79 (MTN)</span>;
                return <span style={{ fontSize:11, color:'#10b981' }}>✓ Valid phone (+250{form.seller_phone})</span>;
              })()}
            </div>
            <div className="form-group">
              <label className="form-label">Seller E-mail *</label>
              <input className="f-inp" name="seller_email" value={form.seller_email} onChange={h} placeholder="email@example.com" />
              {form.seller_email && (() => { if (!validateEmail(form.seller_email)) return <span style={{ fontSize: 11, color: '#ef4444' }}>Use Gmail, Yahoo, Outlook, or a .rw address</span>; return <span style={{ fontSize: 11, color: '#10b981' }}>✓ Valid email</span>; })()}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Buyer Telephone number *</label>
            <div style={{ display:'flex', alignItems:'stretch', border:'1.5px solid var(--g200)', borderRadius:'var(--rl)', overflow:'hidden', background:'var(--teal-l)', transition:'border-color .22s,box-shadow .22s' }}
              onFocusCapture={e => { e.currentTarget.style.borderColor='var(--teal)'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(13,148,136,.1)'; e.currentTarget.style.background='white'; }}
              onBlurCapture={e => { e.currentTarget.style.borderColor='var(--g200)'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='var(--teal-l)'; }}>
              <span style={{ display:'flex', alignItems:'center', padding:'0 10px 0 13px', fontSize:13, fontWeight:700, color:'var(--teal)', whiteSpace:'nowrap', userSelect:'none' }}>+250</span>
              <input
                style={{ flex:1, padding:'10px 13px', fontSize:13, fontFamily:'"Times New Roman",Times,serif', background:'transparent', border:'none', outline:'none', color:'var(--dark)', minWidth:0 }}
                name="buyer_phone"
                type="text"
                inputMode="numeric"
                placeholder="7XXXXXXXXX"
                value={form.buyer_phone}
                maxLength={9}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setForm(f => ({ ...f, buyer_phone: digits }));
                }}
              />
            </div>
            {form.buyer_phone && (() => {
              if (form.buyer_phone.length < 9) return <span style={{ fontSize:11, color:'#f59e0b' }}>⚠ {9 - form.buyer_phone.length} digits remaining</span>;
              if (form.buyer_phone[0] !== '7') return <span style={{ fontSize:11, color:'#ef4444' }}>Must start with 7</span>;
              if (!['72','73','78','79'].includes(form.buyer_phone.slice(0,2))) return <span style={{ fontSize:11, color:'#ef4444' }}>Prefix must be 72/73 (TIGO) or 78/79 (MTN)</span>;
              return <span style={{ fontSize:11, color:'#10b981' }}>✓ Valid phone (+250{form.buyer_phone})</span>;
            })()}
          </div>
        </div>
        
        {sectionTitle('Marital Status of Seller')}
        <div style={{ padding: '0 20px 6px' }}>
          <div style={{ fontSize: 13, marginBottom: 10, color: '#4d7c77' }}>If the seller is married, the spouse must also provide their ID and sign the agreement.</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {[['no', 'Not Married'], ['yes', 'Married']].map(([v, l]) => (
              <label key={v} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid ${married === v ? '#0d9488' : 'var(--g200)'}`, borderRadius: 10, cursor: 'pointer', background: married === v ? 'rgba(13,148,136,.05)' : 'white', transition: 'all .15s' }}>
                <input type="radio" name="married" value={v} checked={married === v} onChange={() => setMarried(v)} style={{ accentColor: '#0d9488' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span>
              </label>
            ))}
          </div>
          {married === 'yes' && (
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Spouse Full Name *</label><input className="f-inp" name="spouse_name" value={form.spouse_name} onChange={h} placeholder="Spouse full name" /></div>
              <div className="form-group">
                <label className="form-label">Spouse National ID *</label>
                <input className="f-inp" name="spouse_national_id" value={form.spouse_national_id} onChange={h} placeholder="16-digit ID" maxLength={16} style={{ fontFamily: 'monospace' }} />
                {form.spouse_national_id && (() => { if (form.spouse_national_id.length < 16) return <span style={{ fontSize: 11, color: '#4d7c77' }}>{16 - form.spouse_national_id.length} digits remaining</span>; const r = validateNationalId(form.spouse_national_id); if (!r.ok) return <span style={{ fontSize: 11, color: '#ef4444' }}>{r.msg}</span>; return <span style={{ fontSize: 11, color: '#10b981' }}>✓ Valid ID</span>; })()}
              </div>
            </div>
          )}
        </div>
        
        {sectionTitle('FORM 11.a — Parcel Information')}
        <div style={{ padding: '0 20px 6px' }}>
          <div className="form-group">
            <label className="form-label">UPI — Unique Parcel Identifier *</label>
            <input 
              className="f-inp" 
              name="upi" 
              value={form.upi} 
              onChange={e => handleUpiChange(e.target.value)} 
              placeholder="xx/xx/xx/xx/xxxx" 
              style={{ fontFamily: 'monospace' }} 
            />
            {searchingUpi && <span style={{ fontSize: 11, color: '#0d9488', marginTop: 4 }}><Ic.Spin /> Searching parcel details...</span>}
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Province / City of Kigali *</label><input className="f-inp" name="province" value={form.province} onChange={h} placeholder="Auto-fills after UPI search" /></div>
            <div className="form-group"><label className="form-label">District *</label><input className="f-inp" name="district" value={form.district} onChange={h} placeholder="Auto-fills after UPI search" /></div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Sector *</label><input className="f-inp" name="sector" value={form.sector} onChange={h} placeholder="Auto-fills after UPI search" /></div>
            <div className="form-group"><label className="form-label">Cell *</label><input className="f-inp" name="cell" value={form.cell} onChange={h} placeholder="Auto-fills after UPI search" /></div>
          </div>
          <div className="form-group"><label className="form-label">Village *</label><input className="f-inp" name="village" value={form.village} onChange={h} placeholder="Auto-fills after UPI search" /></div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">% of Rights to Transfer *</label><input className="f-inp" name="percentage" type="number" min="1" max="100" value={form.percentage} onChange={h} /></div>
            <div className="form-group"><label className="form-label">Agreed Price (RWF) *</label><input className="f-inp" name="agreed_price" type="number" value={form.agreed_price} onChange={h} placeholder="e.g. 7500000" /></div>
          </div>
          <div className="form-group"><label className="form-label">Motivation for the Request</label><textarea className="f-inp" name="motivation" value={form.motivation} onChange={h} rows={3} placeholder="Explain why you are selling this land parcel..." /></div>
        </div>
        
        {sectionTitle('FORM 11.b — Buyer Information')}
        <div style={{ padding: '0 20px 6px' }}>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Buyer Full Name *</label><input className="f-inp" name="buyer_name" value={form.buyer_name} onChange={h} placeholder="Full name as on ID" /></div>
            <div className="form-group">
              <label className="form-label">Buyer National ID *</label>
              <input className="f-inp" name="buyer_national_id" value={form.buyer_national_id} onChange={h} placeholder="16-digit ID number" maxLength={16} style={{ fontFamily: 'monospace' }} />
              {form.buyer_national_id && (() => { if (form.buyer_national_id.length < 16) return <span style={{ fontSize: 11, color: '#4d7c77' }}>{16 - form.buyer_national_id.length} digits remaining</span>; const r = validateNationalId(form.buyer_national_id); if (!r.ok) return <span style={{ fontSize: 11, color: '#ef4444' }}>{r.msg}</span>; return <span style={{ fontSize: 11, color: '#10b981' }}>✓ Valid ID</span>; })()}
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Buyer District *</label><input className="f-inp" name="buyer_district" value={form.buyer_district} onChange={h} placeholder="e.g. Kicukiro" /></div>
            <div className="form-group"><label className="form-label">Buyer Sector *</label><input className="f-inp" name="buyer_sector" value={form.buyer_sector} onChange={h} placeholder="e.g. Niboye" /></div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Buyer Cell *</label><input className="f-inp" name="buyer_cell" value={form.buyer_cell} onChange={h} placeholder="e.g. Kagarama" /></div>
            <div className="form-group"><label className="form-label">Buyer Village *</label><input className="f-inp" name="buyer_village" value={form.buyer_village} onChange={h} placeholder="e.g. Gikondo" /></div>
          </div>
        </div>
        
        {sectionTitle('FORM 11.b — Transfer Contract Values')}
        <div style={{ padding: '0 20px 6px' }}>
          <div style={{ background: 'var(--teal-l)', border: '1px solid var(--g200)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#4d7c77', marginBottom: 12 }}>
            <Ic.Info /> The total sale amount includes the value of land plus any development on the land.
          </div>
          <div className="form-grid">
            <div className="form-group"><label className="form-label">Value of Land (RWF) *</label><input className="f-inp" name="land_value" value={form.land_value} onChange={h} type="number" placeholder="e.g. 7000000" /></div>
            <div className="form-group"><label className="form-label">Value of Development (RWF)</label><input className="f-inp" name="development_value" value={form.development_value} onChange={h} type="number" placeholder="0 if no buildings" /></div>
          </div>
          {form.land_value && (
            <div style={{ fontSize: 13, padding: '10px 14px', background: '#f0fdfa', borderRadius: 10, border: '1px solid var(--g200)', marginBottom: 10 }}>
              <div>Total Sale Amount: <strong>{fmt((parseFloat(form.land_value) || 0) + (parseFloat(form.development_value) || 0))}</strong></div>
              <div style={{ marginTop: 3, color: '#f59e0b', fontSize: 12 }}>Tax (2.5% above 5M RWF): <strong>{fmt(calcTax((parseFloat(form.land_value) || 0) + (parseFloat(form.development_value) || 0)))}</strong></div>
            </div>
          )}
        </div>
        
        {sectionTitle('REQUIRED DOCUMENTS CHECKLIST (FORM 11.A)')}
        <div style={{ padding: '0 20px 6px' }}>
          {[
            ['doc_identity', 'Proof of identity of the seller(s) and buyer(s)'],
            ['doc_civil_status', 'Civil status certificate of buyer(s) and seller(s)'],
            ['doc_land_title', 'Land documents for the parcel to be sold']
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', border: '1.5px solid #0d9488', borderRadius: 10, background: 'rgba(13,148,136,.05)', marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#0d9488', color: 'white', fontSize: 10, marginTop: 1 }}>✓</div>
              <span style={{ fontSize: 13 }}>{label}</span>
            </div>
          ))}
          <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 12, color: '#92400e', marginBottom: 10 }}>The Notarised sale agreement will be completed and signed by the notary during your appointment.</div>
        </div>
        
        {sectionTitle('Upload Documents to System (ALL REQUIRED)')}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <UploadField label="Seller National ID (scan)" fieldKey="seller_id" uploads={uploads} setUploads={setUploads} required />
            {married === 'yes' && <UploadField label="Spouse National ID (scan)" fieldKey="spouse_id" uploads={uploads} setUploads={setUploads} required />}
            <UploadField label="Buyer National ID (scan)" fieldKey="buyer_id" uploads={uploads} setUploads={setUploads} required />
            <UploadField label="Land Title Document (scan)" fieldKey="land_title" uploads={uploads} setUploads={setUploads} required />
            <UploadField label="Civil Status Certificate — Seller" fieldKey="civil_cert_seller" uploads={uploads} setUploads={setUploads} required />
            <UploadField label="Civil Status Certificate — Buyer" fieldKey="civil_cert_buyer" uploads={uploads} setUploads={setUploads} required />
          </div>
        </div>
        
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ padding: '11px 20px', borderRadius: 12, border: '1.5px solid var(--g200)', background: 'white', cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', fontWeight: 600, fontSize: 14 }}>← Back</button>
          <button className="btn-pred" style={{ margin: 0, width: 'auto', padding: '12px 28px' }} onClick={submit} disabled={saving}>
            {saving ? <><Ic.Spin /> Submitting Form…</> : <><Ic.FileText /> Submit Form 11.a &amp; 11.b → Select Notary</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Notary Request ─────────────────────────────────────────
function ViewNotaryRequest({ user, agreement, addAlert, onRequestSent, onBack }) {
  const [notaries, setNotaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);

  // Location cascades
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [loadingNotaries, setLoadingNotaries] = useState(false);

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedSectorName, setSelectedSectorName] = useState('');
  const selectedSectorNameRef = useRef('');

  // notary type tab: 'sector' | 'private'
  const [typeFilter, setTypeFilter] = useState('sector');

  // Load provinces on mount
  useEffect(() => {
    fetch(`${API}/locations/provinces`)
      .then(r => r.json())
      .then(d => { if (d.success) setProvinces(d.provinces || []); })
      .catch(() => addAlert('Could not load provinces', 'error'));
  }, []);

  // Load districts when province changes
  useEffect(() => {
    if (!selectedProvince) { setDistricts([]); setSelectedDistrict(''); setSectors([]); setSelectedSector(''); setSelectedSectorName(''); setNotaries([]); return; }
    setLoadingDistricts(true);
    setSelectedDistrict(''); setSectors([]); setSelectedSector(''); setSelectedSectorName(''); setNotaries([]);
    fetch(`${API}/locations/districts/by-province`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ province_id: parseInt(selectedProvince) })
    })
      .then(r => r.json())
      .then(d => { if (d.success) setDistricts(d.districts || []); })
      .catch(() => addAlert('Could not load districts', 'error'))
      .finally(() => setLoadingDistricts(false));
  }, [selectedProvince]);

  // Load sectors when district changes
  useEffect(() => {
    if (!selectedDistrict) { setSectors([]); setSelectedSector(''); setSelectedSectorName(''); setNotaries([]); return; }
    setLoadingSectors(true);
    setSelectedSector(''); setSelectedSectorName(''); setNotaries([]);
    fetch(`${API}/locations/sectors/by-district`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ district_id: parseInt(selectedDistrict) })
    })
      .then(r => r.json())
      .then(d => { if (d.success) setSectors(d.sectors || []); })
      .catch(() => addAlert('Could not load sectors', 'error'))
      .finally(() => setLoadingSectors(false));
  }, [selectedDistrict]);

  // Load notaries when sector changes
  useEffect(() => {
    if (!selectedSector) { setNotaries([]); setSelected(null); return; }
    const sectorName = selectedSectorNameRef.current;
    if (!sectorName) { setNotaries([]); setSelected(null); return; }
    setLoadingNotaries(true);
    setSelected(null);
    fetch(`${API}/notaries/all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const all = d.notaries || [];
          const sectorFiltered = all.filter(n => {
            const ns = (n.sector_name || n.sector || '').toLowerCase().trim();
            return ns === sectorName.toLowerCase().trim();
          });
          setNotaries(sectorFiltered);
          if (sectorFiltered.length === 0) {
            addAlert(`No notaries found in ${sectorName} sector.`, 'warning');
          }
        }
      })
      .catch(() => addAlert('Could not load notaries', 'error'))
      .finally(() => setLoadingNotaries(false));
  }, [selectedSector]);

  // Filtered notaries by type tab
  const filtered = notaries.filter(n => {
    const ntype = (n.notary_type || 'sector').toLowerCase();
    return ntype === typeFilter;
  });

  async function sendRequest() {
    if (!selectedSector) { addAlert('Please select a sector first', 'error'); return; }
    if (!selected) { addAlert('Please select a notary', 'error'); return; }
    const notary = notaries.find(n => String(n.id) === String(selected));
    setSending(true);
    try {
      const r = await fetch(`${API}/notary-request/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreement_id: agreement?.id,
          form_id: agreement?.form_id,
          listing_id: agreement?.listing_id,
          seller_id: user?.id,
          buyer_id: agreement?.buyer_id,
          upi: agreement?.upi,
          notary_id: notary?.id,
          notary_name: notary?.full_name,
          notary_email: notary?.email,
          notary_sector: notary?.sector_name || notary?.sector,
          notary_type: notary?.notary_type || typeFilter
        })
      });
      const d = await r.json();
      if (d.success) {
        addAlert(`Request sent to notary ${notary?.full_name}!`, 'success');
        onRequestSent({
          ...agreement,
          notary_id: notary?.id,
          notary_name: notary?.full_name,
          notary_type: notary?.notary_type
        });
      } else {
        addAlert(d.message || 'Failed to send request', 'error');
      }
    } catch {
      addAlert('Cannot connect to server', 'error');
    }
    setSending(false);
  }

  const selectStyle = {
    width: '100%',
    padding: '10px 13px',
    fontSize: 13,
    fontFamily: '"Times New Roman",Times,serif',
    background: 'var(--teal-l)',
    border: '1.5px solid var(--g200)',
    borderRadius: 'var(--rl)',
    color: 'var(--dark)',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234d7c77' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 34,
  };

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Notary /> Select Notary &amp; Send Request</span>
          <button onClick={onBack} className="btn-back-small">← Back</button>
        </div>

        {/* Agreement summary */}
        <div style={{ margin: '12px 20px 0', padding: '12px 16px', background: 'var(--teal-l)', borderRadius: 12, border: '1px solid var(--g200)', fontSize: 13 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>UPI: {agreement?.upi}</div>
          <div style={{ marginTop: 4 }}>Form Reference: <strong style={{ fontFamily: 'monospace' }}>{agreement?.form_ref || '—'}</strong></div>
          <div>Agreed Price: <strong>{Math.round(agreement?.agreed_price || 0).toLocaleString('en-US')} RWF</strong></div>
        </div>

        {/* Step 1 — Location selectors */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ic.MapPin /> Step 1 — Select Location
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            {/* Province */}
            <div className="form-group">
              <label className="form-label">Province *</label>
              <select
                style={selectStyle}
                value={selectedProvince}
                onChange={e => setSelectedProvince(e.target.value)}
              >
                <option value="">— Select Province —</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* District */}
            <div className="form-group">
              <label className="form-label">District *</label>
              <select
                style={{ ...selectStyle, opacity: !selectedProvince ? 0.5 : 1 }}
                value={selectedDistrict}
                onChange={e => setSelectedDistrict(e.target.value)}
                disabled={!selectedProvince || loadingDistricts}
              >
                <option value="">
                  {loadingDistricts ? 'Loading…' : !selectedProvince ? '— Select Province first —' : '— Select District —'}
                </option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sector — full width */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Sector *</label>
            <select
              style={{ ...selectStyle, opacity: !selectedDistrict ? 0.5 : 1 }}
              value={selectedSector}
              onChange={e => {
                const sectorId = e.target.value;
                const sectorObj = sectors.find(s => String(s.id) === String(sectorId));
                const sectorName = sectorObj?.name || '';
                selectedSectorNameRef.current = sectorName;
                setSelectedSector(sectorId);
                setSelectedSectorName(sectorName);
              }}
              disabled={!selectedDistrict || loadingSectors}
            >
              <option value="">
                {loadingSectors ? 'Loading…' : !selectedDistrict ? '— Select District first —' : '— Select Sector —'}
              </option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Step 2 — Notary type + list */}
        {selectedSector && (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ic.Notary /> Step 2 — Choose Notary Type
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--teal-l)', borderRadius: 12, padding: 4, border: '1px solid var(--g200)', marginBottom: 14 }}>
              {[
                ['sector', 'Sector Notary', '#0d9488'],
                ['private', 'Private Notary', '#7c3aed']
              ].map(([v, l, color]) => (
                <button
                  key={v}
                  onClick={() => { setTypeFilter(v); setSelected(null); }}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    border: 'none',
                    borderRadius: 9,
                    cursor: 'pointer',
                    fontFamily: '"Times New Roman",Times,serif',
                    fontSize: 13,
                    fontWeight: 700,
                    background: typeFilter === v ? color : 'transparent',
                    color: typeFilter === v ? 'white' : '#4d7c77',
                    transition: 'all .15s',
                  }}
                >
                  {l}
                  {' '}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 20,
                    height: 20,
                    borderRadius: 50,
                    fontSize: 11,
                    fontWeight: 800,
                    background: typeFilter === v ? 'rgba(255,255,255,.25)' : 'rgba(13,148,136,.12)',
                    color: typeFilter === v ? 'white' : '#0d9488',
                    padding: '0 6px',
                  }}>
                    {notaries.filter(n => (n.notary_type || 'sector').toLowerCase() === v).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Notary list */}
            {loadingNotaries && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: '#4d7c77', fontSize: 13 }}>
                <Ic.Spin /> Loading notaries in {selectedSectorName}…
              </div>
            )}

            {!loadingNotaries && filtered.length === 0 && (
              <div className="empty-state" style={{ padding: '24px 0', textAlign: 'center' }}>
                No {typeFilter} notaries in <strong>{selectedSectorName}</strong> sector.
                <br />
                <span style={{ fontSize: 12, color: '#4d7c77', display: 'block', marginTop: 6 }}>
                  Try switching to {typeFilter === 'sector' ? 'Private' : 'Sector'} Notary, or select a different sector.
                </span>
              </div>
            )}

            {!loadingNotaries && filtered.map(n => {
              const isSelected = String(selected) === String(n.id);
              const type = (n.notary_type || 'sector').toLowerCase();
              const accentColor = type === 'private' ? '#7c3aed' : '#0d9488';
              return (
                <label
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    marginBottom: 8,
                    border: `1.5px solid ${isSelected ? accentColor : 'var(--g200)'}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: isSelected ? `${accentColor}08` : 'white',
                    transition: 'all .15s',
                  }}
                >
                  <input
                    type="radio"
                    name="notary_sel"
                    checked={isSelected}
                    onChange={() => setSelected(n.id)}
                    style={{ accentColor }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{n.full_name}</div>
                    <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>
                      {n.email}
                      <span style={{ color: accentColor, marginLeft: 8, fontWeight: 600 }}>
                        Sector: {n.sector_name || n.sector || selectedSectorName}
                      </span>
                      {n.district_name && ` · ${n.district_name}`}
                      {n.license_number && ` · Lic: ${n.license_number}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 50,
                    background: type === 'private' ? 'rgba(124,58,237,.1)' : 'rgba(13,148,136,.1)',
                    color: accentColor,
                    textTransform: 'uppercase',
                    letterSpacing: '.3px',
                  }}>
                    {type === 'private' ? 'Private' : 'Sector'}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button
            onClick={onBack}
            style={{ padding: '11px 20px', borderRadius: 12, border: '1.5px solid var(--g200)', background: 'white', cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', fontWeight: 600, fontSize: 14 }}
          >
            ← Back to Form
          </button>
          <button
            className="btn-pred"
            style={{
              margin: 0,
              width: 'auto',
              padding: '12px 28px',
              background: selected ? 'linear-gradient(135deg,#0d9488,#0891b2)' : '#94a3b8'
            }}
            disabled={!selected || sending}
            onClick={sendRequest}
          >
            {sending ? <><Ic.Spin /> Sending…</> : <><Ic.Send /> Send Request to Notary</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── My Publications ────────────────────────────────────────
function ViewMyPublications({ user, addAlert, onSellerChatClick }) {
  const [myListings, setMyListings] = useState([]);
  const [buyerRooms, setBuyerRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [pubForm, setPubForm] = useState({ upi: '', asking_price: '', description: '' });
  const [pubLoading, setPubLoading] = useState(false);
  const [historyPrices, setHistoryPrices] = useState(null);
  const [histLookupLoading, setHistLookupLoading] = useState(false);
  const [upiError, setUpiError] = useState('');   // ← ADD THIS LINE
  const upiDebounceRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/listings/mine`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user?.id }) });
      const d = await res.json();
      if (d.success) setMyListings(d.listings || []);
      const roomsRes = await fetch(`${API}/chat/rooms/seller`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seller_id: user?.id }) });
      const roomsD = await roomsRes.json();
      if (roomsD.success) setBuyerRooms(roomsD.rooms || []);
    } catch { addAlert('Failed to load your listings', 'error'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // NEW: lookup history when UPI changes (debounced 600ms)
  function handleUpiChange(val) {
    setPubForm(f => ({ ...f, upi: val }));
    setHistoryPrices(null);
    setUpiError('');
    clearTimeout(upiDebounceRef.current);
    if (!val.trim() || !user?.id) return;
    upiDebounceRef.current = setTimeout(async () => {
      setHistLookupLoading(true);
      try {
        // Step 1: Check if UPI belongs to this user's parcels
        const parcelsRes = await fetch(`${API}/user/parcels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        });
        const parcelsData = await parcelsRes.json();
        const userParcels = parcelsData.success ? (parcelsData.parcels || []) : [];
        const clean = v => String(v).trim().replace(/\s/g, '');
        const ownedParcel = userParcels.find(p => clean(p.upi) === clean(val));
      
        if (!ownedParcel) {
          setUpiError('This UPI is not in your parcels. It may not be yours or you typed it incorrectly.');
          setHistoryPrices(false);
          setHistLookupLoading(false);
          return;
        }

        // Step 2: Check prediction history
        const r = await fetch(`${API}/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        });
        const d = await r.json();
        if (d.success) {
          const match = (d.history || []).find(h => clean(h.upi) === clean(val));
          setHistoryPrices(match || false);
        }
      } catch { }
      setHistLookupLoading(false);
    }, 600);
  }

  async function publish(e) {
    e.preventDefault();
    if (!pubForm.upi.trim()) { addAlert('UPI is required', 'error'); return; }

    // Step 1: Must pass parcel ownership check first
    if (upiError) { addAlert('This UPI is not in your parcels. Fix the UPI first.', 'error'); return; }

    // Step 2: Only check price history AFTER ownership is confirmed
    if (historyPrices === false) { addAlert('No price history found. Go to Predict Price first.', 'error'); return; }

    // Step 3: Still loading — wait
    if (historyPrices === null && pubForm.upi.trim()) { addAlert('Still validating UPI, please wait a moment.', 'warning'); return; }
    if (!pubForm.asking_price || Number(pubForm.asking_price) <= 0) { addAlert('Enter a valid asking price', 'error'); return; }
    setPubLoading(true);
    try {
      const r = await fetch(`${API}/listings/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upi: pubForm.upi.trim(), user_id: user?.id, seller_name: user?.name, phone: user?.phone || user?.phone_number || '', asking_price: Number(pubForm.asking_price), description: pubForm.description }) });
      const d = await r.json();
      if (d.success) { addAlert('Land parcel published successfully!', 'success'); setPubForm({ upi: '', asking_price: '', description: '' }); setShowPublish(false); setHistoryPrices(false); load(); }
      else addAlert(d.message || 'Failed to publish', 'error');
    } catch { addAlert('Cannot connect to server', 'error'); }
    setPubLoading(false);
  }

  async function removeListing(id) {
    if (!confirm('Remove this listing?')) return;
    try {
      const r = await fetch(`${API}/listings/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: id }) });
      const d = await r.json();
      if (d.success) { addAlert('Listing removed', 'success'); setMyListings(prev => prev.filter(l => l.id !== id)); }
      else addAlert(d.message || 'Remove failed', 'error');
    } catch { addAlert('Remove failed', 'error'); }
  }

  async function confirmAgreement(listing, room) {
    if (!confirm(`Confirm agreement with buyer for UPI ${listing.upi}?`)) return;
    try {
      const r = await fetch(`${API}/listings/confirm-agreement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: listing.id, seller_id: user?.id, room: room.room, notary_id: null, notary_name: '', notary_email: '', notary_sector: '', notary_type: '' }) });
      const d = await r.json();
      if (d.success) { addAlert(`Agreement confirmed for UPI ${listing.upi}.`, 'success'); load(); }
      else addAlert(d.message || 'Failed to confirm', 'error');
    } catch { addAlert('Cannot connect to server', 'error'); }
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.MyMap /> My Published Parcels ({myListings.length})</span>
          <button className="btn-pub" onClick={() => { setShowPublish(s => !s); setHistoryPrices(null); }}><Ic.MapPin /> {showPublish ? 'Cancel' : '+ Publish UPI'}</button>
        </div>

        {showPublish && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--g200)' }}>
            <div className="info-banner"><Ic.Phone /><div>Your phone <strong style={{ color: '#0d9488' }}>{user?.phone || '(not set)'}</strong> will be shown to buyers.</div></div>

            <div className="form-grid">
              {/* UPI field */}
              <div className="form-group">
                <label className="form-label">UPI *</label>
                <input
                  className="f-inp"
                  value={pubForm.upi}
                  onChange={e => handleUpiChange(e.target.value)}
                  placeholder="e.g. xx/xx/xx/xx/xxxx"
                />
                {/* ← ADD THIS BLOCK RIGHT HERE, after the input */}
                {upiError && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:10, fontSize:13, color:'#be123c', marginTop:4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {upiError}
                  </div>
                )}
              </div>

              {/* Asking Price field */}
              <div className="form-group">
                <label className="form-label">Asking Price (RWF) *</label>
                <input
                  className="f-inp"
                  type="number"
                  min="1"
                  value={pubForm.asking_price}
                  onChange={e => setPubForm(f => ({ ...f, asking_price: e.target.value }))}
                  placeholder="e.g. 8000000"
                />
              </div>
            </div>

            {/* NEW: Price history strip below the two fields */}
            {pubForm.upi.trim() && (
              <div style={{ marginBottom: 14 }}>
                {histLookupLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4d7c77', padding: '8px 0' }}>
                    <Ic.Spin /> Looking up price history…
                  </div>
                )}

                {!histLookupLoading && historyPrices === false && !upiError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 13, color: '#92400e' }}>
                    <Ic.Info />
                    <span>No price history found for this UPI. Please go to <strong>Predict Price</strong> first to generate and store an estimate.</span>
                  </div>
                )}

                {!histLookupLoading && historyPrices && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
                      Estimated Prices from History
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Minimum', total: historyPrices.min_price, sqm: historyPrices.min_per_sqm, cls: 'minimum' },
                        { label: 'Average', total: historyPrices.avg_price, sqm: historyPrices.avg_per_sqm, cls: 'average' },
                        { label: 'Maximum', total: historyPrices.max_price, sqm: historyPrices.max_per_sqm, cls: 'maximum' },
                      ].map(pc => (
                        <div
                          key={pc.label}
                          className={`price-card ${pc.cls}`}
                          style={{ padding: '10px 12px', cursor: 'pointer', transition: 'transform .15s' }}
                          title={`Click to use ${pc.label.toLowerCase()} as asking price`}
                          onClick={() => setPubForm(f => ({ ...f, asking_price: String(Math.round(pc.total)) }))}
                        >
                          <div className="price-label">{pc.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0c1a19', margin: '3px 0' }}>
                            {Math.round(pc.total || 0).toLocaleString('en-US')} RWF
                          </div>
                          <div style={{ fontSize: 11, color: '#4d7c77' }}>
                            {Math.round(pc.sqm || 0).toLocaleString('en-US')} RWF/m²
                          </div>
                          <div style={{ fontSize: 10, color: '#0d9488', marginTop: 4, fontWeight: 600 }}>
                            Click to use ↑
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="f-inp" rows={2} value={pubForm.description} onChange={e => setPubForm(f => ({ ...f, description: e.target.value }))} placeholder="Location details, features…" />
            </div>
            <button className="btn-pred" onClick={publish} disabled={pubLoading}>
              {pubLoading ? <><Ic.Spin /> Publishing…</> : <><Ic.Tag /> Publish Listing</>}
            </button>
          </div>
        )}

        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && myListings.length === 0 && !showPublish && <div className="empty-state">No active listings. Click "+ Publish UPI" to add one.</div>}
        {!loading && myListings.map(l => {
          const listingRooms = buyerRooms.filter(r => r.listing_id === l.id);
          return (
            <div key={l.id} className="listing-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: listingRooms.length ? 10 : 0 }}>
                <div style={{ flex: 1 }}>
                  <div className="listing-upi">{l.upi}</div>
                  <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}><strong>{user?.name}</strong> · <Ic.Phone /> <a href={`tel:${l.phone || user?.phone}`} style={{ color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>{l.phone || user?.phone || '—'}</a></div>
                  <div className="listing-price">{fmt(l.asking_price || 0)}</div>
                  {l.description && <div className="listing-desc">{l.description}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="status-badge active">● active</span>
                  <button className="btn-del" onClick={() => removeListing(l.id)}><Ic.Trash /></button>
                </div>
              </div>
              {listingRooms.length > 0 && (
                <div style={{ borderTop: '1px solid var(--g200)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ic.Bell /> {listingRooms.length} Buyer{listingRooms.length > 1 ? 's' : ''} interested
                  </div>
                  {listingRooms.map(room => (
                    <div key={room.room} style={{ display: 'flex', flexDirection: 'column', padding: '10px 12px', background: 'var(--teal-l)', borderRadius: 10, border: '1px solid var(--g200)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{room.buyer_name || 'Unknown Buyer'}</div>
                          <div style={{ fontSize: 11, color: '#4d7c77' }}>{room.message_count} messages · Last: {fmtDate(room.last_message_at)}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-p" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onSellerChatClick({ listing: l, room: room.room, buyerName: room.buyer_name })}><Ic.Chat /> Reply</button>
                          {room.agreed
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', padding: '6px 10px', background: 'rgba(16,185,129,.1)', borderRadius: 8 }}>✓ Agreed</span>
                            : <button className="btn-p" style={{ padding: '6px 12px', fontSize: 12, background: 'linear-gradient(135deg,#22c55e,#16a34a)' }} onClick={() => confirmAgreement(l, room)}><Ic.Check /> Confirm Agreement</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Public Listings with Google Maps ────────────────────────────────────────
function ViewPublicListings({ user, addAlert, onChatClick }) {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [travelTime, setTravelTime] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [parcelAddress, setParcelAddress] = useState(null);
  const [parcelCoords, setParcelCoords] = useState(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      setMapError('API key not configured');
      return;
    }
    
    if (!document.querySelector('#google-maps-script')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps loaded successfully');
        setMapLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps');
        setMapError('Failed to load Google Maps');
      };
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('User location obtained:', position.coords.latitude, position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setMapError(`Location error: ${error.message}`);
        }
      );
    } else {
      console.warn('Geolocation not supported');
      setMapError('Geolocation not supported by your browser');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/listings/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json())
      .then(d => { 
        if (d.success) setPublications((d.listings || []).filter(l => String(l.user_id) !== String(user?.id) && !l.is_agreed)); 
      })
      .catch(() => addAlert('Failed to load listings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch parcel details including location
  const fetchParcelLocation = async (upi) => {
    try {
      console.log('Fetching parcel details for UPI:', upi);
      const response = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi })
      });
      const data = await response.json();
      console.log('Parcel search response:', data);
      if (data.success && data.data) {
        return data.data;
      }
    } catch (error) {
      console.error('Error fetching parcel location:', error);
    }
    return null;
  };

  // Geocode address to coordinates
  const getCoordinates = async (address) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('No API key for geocoding');
      return null;
    }
    
    try {
      console.log('Geocoding address:', address);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      console.log('Geocoding response:', data);
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        console.log('Coordinates found:', location);
        return location;
      } else {
        console.error('No results for address:', address);
        console.error('Geocoding status:', data.status);
        setMapError(`Could not find location: ${data.status}`);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setMapError('Geocoding failed');
    }
    return null;
  };

  // Calculate distance and travel time between two points
  const calculateDistanceAndTime = async (origin, destination) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !origin || !destination) return null;
    
    try {
      console.log('Calculating distance between:', origin, destination);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}`
      );
      const data = await response.json();
      console.log('Distance matrix response:', data);
      if (data.rows && data.rows[0] && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0];
        if (element.status === 'OK') {
          return {
            distance: element.distance.text,
            duration: element.duration.text,
            distanceValue: element.distance.value,
            durationValue: element.duration.value
          };
        } else {
          console.error('Distance calculation status:', element.status);
          setMapError(`Distance calculation: ${element.status}`);
        }
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
      setMapError('Distance calculation failed');
    }
    return null;
  };

  // When a parcel is selected, get its coordinates and calculate distance
  const handleViewMap = async (listing) => {
    console.log('View Map clicked for listing:', listing);
    setIsLoadingMap(true);
    setMapError(null);
    setSelectedParcel(listing);
    setDistance(null);
    setTravelTime(null);
    setParcelCoords(null);
    setParcelAddress(null);
  
    // Fetch full parcel details to get location
    const parcelDetails = await fetchParcelLocation(listing.upi);
    console.log('Parcel details:', parcelDetails);
    
    if (parcelDetails) {
      // Build address from parcel details
      const addressParts = [];
      if (parcelDetails.Sector && parcelDetails.Sector !== 'N/A') addressParts.push(parcelDetails.Sector);
      if (parcelDetails.District && parcelDetails.District !== 'N/A') addressParts.push(parcelDetails.District);
      if (parcelDetails.Province && parcelDetails.Province !== 'N/A') addressParts.push(parcelDetails.Province);
      addressParts.push('Rwanda');
      
      const address = addressParts.join(', ');
      console.log('Built address:', address);
      setParcelAddress(address);
      
      if (!address || address === 'Rwanda') {
        setMapError('Parcel location information incomplete');
        setIsLoadingMap(false);
        return;
      }
      
      const coords = await getCoordinates(address);
      if (coords) {
        setParcelCoords(coords);
        
        if (userLocation) {
          const result = await calculateDistanceAndTime(userLocation, coords);
          if (result) {
            setDistance(result.distance);
            setTravelTime(result.duration);
          }
        } else {
          console.log('No user location available');
          setMapError('Enable location services to see distance');
        }
      } else {
        setMapError('Could not find parcel location on map');
      }
    } else {
      setMapError('Could not fetch parcel details');
    }
    setIsLoadingMap(false);
  };

  const filtered = publications.filter(l => 
    !search || 
    (l.upi || '').toLowerCase().includes(search.toLowerCase()) || 
    (l.seller_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Get static map image URL
  const getStaticMapUrl = () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !parcelAddress) return null;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(parcelAddress)}&zoom=14&size=600x250&markers=color:red%7C${encodeURIComponent(parcelAddress)}&key=${apiKey}`;
  };

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Map /> Available Parcels ({filtered.length})</span>
          <div className="search-wrap-inline"><Ic.Search /><input className="s-inp-sm" placeholder="Search UPI or seller…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state">No parcels available.</div>}
        {!loading && filtered.map(l => (
          <div key={l.id} className="listing-row buy-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="listing-upi teal">{l.upi}</div>
                <div className="listing-price">{fmt(l.asking_price || 0)}</div>
                {l.description && <div className="listing-desc">{l.description}</div>}
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#4d7c77', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ic.User /> {l.seller_name}</span>
                  {l.phone && <a href={`tel:${l.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0d9488', textDecoration: 'none', fontWeight: 700 }}><Ic.Phone /> {l.phone}</a>}
                  <span>{fmtDate(l.created_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn-p" 
                  style={{ padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap', background: 'linear-gradient(135deg,#0891b2,#0d9488)' }} 
                  onClick={() => handleViewMap(l)}
                  disabled={isLoadingMap}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {isLoadingMap && selectedParcel === l ? 'Loading...' : 'View Map'}
                </button>
                <button className="btn-p" style={{ padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => onChatClick(l)}>
                  <Ic.Chat /> Chat &amp; Agree
                </button>
              </div>
            </div>
            
            {/* Google Map Section - expands when View Map is clicked */}
            {selectedParcel === l && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--g200)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Parcel Location</span>
                  <button 
                    onClick={() => setSelectedParcel(null)} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                  >
                    Close ×
                  </button>
                </div>
                
                {/* Loading state */}
                {isLoadingMap && (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f0fdfa', borderRadius: 12 }}>
                    <Ic.Spin /> Loading map...
                  </div>
                )}
                
                {/* Error message */}
                {mapError && !isLoadingMap && (
                  <div style={{ 
                    background: '#fff1f2', 
                    borderRadius: 10, 
                    padding: '10px 14px', 
                    marginBottom: 12,
                    fontSize: 12,
                    color: '#be123c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Ic.Info />
                    <span>{mapError}</span>
                  </div>
                )}
                
                {/* Distance and Travel Time Info */}
                {!isLoadingMap && userLocation && distance && travelTime && (
                  <div style={{ 
                    background: 'linear-gradient(135deg, rgba(13,148,136,.08), rgba(8,145,178,.08))',
                    borderRadius: 12, 
                    padding: '10px 14px', 
                    marginBottom: 12,
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Distance: <strong style={{ color: '#0d9488' }}>{distance}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Estimated Travel: <strong style={{ color: '#0d9488' }}>{travelTime}</strong></span>
                    </div>
                  </div>
                )}
                
                {!isLoadingMap && !userLocation && !mapError && (
                  <div style={{ 
                    background: '#fef3c7', 
                    borderRadius: 10, 
                    padding: '10px 14px', 
                    marginBottom: 12,
                    fontSize: 12,
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Ic.Info />
                    <span>Enable location services to see distance from your location.</span>
                  </div>
                )}
                
                {/* Address display */}
                {!isLoadingMap && parcelAddress && (
                  <div style={{ 
                    background: '#f0fdfa', 
                    borderRadius: 10, 
                    padding: '8px 12px', 
                    marginBottom: 12,
                    fontSize: 12,
                    color: '#4d7c77',
                    wordBreak: 'break-all'
                  }}>
                    <strong>Location:</strong> {parcelAddress}
                  </div>
                )}
                
                {/* Static Map Image */}
                {!isLoadingMap && parcelAddress && !mapError && (
                  <div 
                    style={{ 
                      width: '100%', 
                      height: '250px', 
                      borderRadius: 12, 
                      overflow: 'hidden',
                      background: '#f0fdfa',
                      border: '1px solid var(--g200)',
                      position: 'relative'
                    }}
                  >
                    <img 
                      src={getStaticMapUrl()}
                      alt="Parcel location map"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        console.error('Static map image failed to load');
                        e.target.style.display = 'none';
                        setMapError('Map image could not be loaded');
                      }}
                    />
                  </div>
                )}
                
                {/* Open in Google Maps button */}
                {!isLoadingMap && parcelAddress && !mapError && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parcelAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        fontSize: 12, 
                        color: '#0d9488', 
                        textDecoration: 'none',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Open in Google Maps ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agreements ─────────────────────────────────────────────
function ViewAgreements({ user, addAlert, onFillForm }) {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellerAgreements, setSellerAgreements] = useState([]);

  function load() {
    fetch(`${API}/agreements/buyer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer_id: user?.id }) })
      .then(r => r.json()).then(d => { if (d.success) setAgreements(d.agreements || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    fetch(`${API}/agreements/seller`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seller_id: user?.id }) })
      .then(r => r.json()).then(d => { if (d.success) setSellerAgreements(d.agreements || []); }).catch(() => {});
  }, [user?.id]);

  const statusColor = s => ({ notary_requested: '#0891b2', appointment_set: '#7c3aed', stamped: '#10b981', sent_to_district: '#22c55e' }[s] || '#f59e0b');
  const statusLabel = s => ({ notary_requested: 'Notary Requested', appointment_set: 'Appointment Set', stamped: 'Stamped & Signed', sent_to_district: 'Sent to District' }[s] || 'Awaiting Form');

  return (
    <div className="view">
      {sellerAgreements.length > 0 && (
        <div className="card">
          <div className="card-hd"><Ic.FileText /> Your Confirmed Agreements — Fill Sale Form</div>
          {sellerAgreements.map(ag => (
            <div key={ag.id} style={{ borderTop: '1px solid var(--g200)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 14 }}>{ag.upi}</div>
                  <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 3 }}>Buyer: <strong>{ag.buyer_name}</strong></div>
                  <div style={{ fontSize: 12, color: '#4d7c77' }}>Agreed Price: <strong>{fmt(ag.agreed_price || 0)}</strong></div>
                  <div style={{ fontSize: 11, color: ag.form_status === 'appointment_set' ? '#7c3aed' : '#f59e0b', fontWeight: 700, marginTop: 4 }}>Status: {statusLabel(ag.form_status)}</div>
                  {ag.appointment_date && (
                    <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginTop: 3 }}>
                      Appointment: {fmtDate(ag.appointment_date)}{ag.appointment_time ? ` at ${ag.appointment_time}` : ''}
                    </div>
                  )}
                </div>
                <div>
                  {!ag.form_status || ag.form_status === 'pending'
                    ? <button className="btn-p" style={{ padding: '8px 14px', fontSize: 12, background: 'linear-gradient(135deg,#7c3aed,#0d9488)' }} onClick={() => onFillForm(ag)}><Ic.FileText /> Fill Form 11.a &amp; 11.b</button>
                    : ag.form_status === 'form_submitted'
                      ? <button className="btn-p" style={{ padding: '8px 14px', fontSize: 12, background: 'linear-gradient(135deg,#0d9488,#0891b2)' }} onClick={() => onFillForm({ ...ag, skipToNotary: true })}><Ic.Notary /> Select Notary</button>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(ag.form_status), padding: '6px 10px', background: 'rgba(13,148,136,.1)', borderRadius: 8 }}>● {statusLabel(ag.form_status)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="card-hd"><Ic.Handshake /> Confirmed Agreements (Buyer View)</div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && agreements.length === 0 && <div className="empty-state">No confirmed agreements yet.</div>}
        {!loading && agreements.map(ag => (
          <div key={ag.id} style={{ borderTop: '1px solid var(--g200)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 14 }}>{ag.upi}</div>
                <div style={{ fontSize: 12, color: '#4d7c77', marginTop: 3 }}>Seller: <strong>{ag.seller_name}</strong></div>
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 3 }}>✓ Confirmed on {fmtDate(ag.confirmed_at)}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.1)', padding: '4px 12px', borderRadius: 50 }}>Confirmed</span>
            </div>
            <div style={{ background: 'var(--teal-l)', border: '1.5px solid var(--g200)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4d7c77', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 12 }}>Transfer Progress</div>
              {[
                { done: true, label: 'Seller confirmed agreement', sub: `Confirmed on ${fmtDate(ag.confirmed_at)}` },
                { done: !!ag.form_submitted_at, label: 'Seller filled Form 11.a & 11.b', sub: ag.form_submitted_at ? `Submitted on ${fmtDate(ag.form_submitted_at)}` : 'Seller is filling the form' },
                { done: !!ag.notary_name, label: 'Seller selected a notary', sub: ag.notary_name ? `Notary: ${ag.notary_name}` : 'Waiting for notary selection' },
                { done: !!ag.appointment_date, label: 'Notary set appointment date', sub: ag.appointment_date ? `Date: ${fmtDate(ag.appointment_date)} at ${ag.appointment_time || '—'}` : 'Notary will contact you' },
                { done: !!ag.stamped_at, label: 'Signed & stamped at notary office', sub: ag.stamped_at ? 'Completed' : 'Bring original National ID' },
                { done: !!ag.sent_to_district_at, label: 'Notary sent documents to district', sub: ag.sent_to_district_at ? 'District processing transfer' : 'Notary reports to district digitally' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 5 ? 10 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: step.done ? 'linear-gradient(135deg,#10b981,#0d9488)' : 'rgba(13,148,136,.1)', color: step.done ? 'white' : '#0d9488', border: step.done ? 'none' : '1.5px solid var(--g300)', marginTop: 1 }}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: step.done ? 700 : 600, color: step.done ? '#0c1a19' : '#4d7c77' }}>{step.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{step.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Chat (Buyer) ───────────────────────────────────────────
function ViewChat({ user, listing, onBack, addAlert }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const lastIdRef = useRef(0);
  const room = `listing_${listing.id}_buyer_${user?.id}`;

  async function fetchMsgs(sinceId = 0) {
    try {
      const r = await fetch(`${API}/chat/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, since_id: sinceId }) });
      const d = await r.json();
      if (d.success && d.messages?.length > 0) {
        setMsgs(prev => { const existingIds = new Set(prev.map(m => m.id)); const newMsgs = d.messages.filter(m => !existingIds.has(m.id)); if (newMsgs.length > 0) { lastIdRef.current = newMsgs[newMsgs.length - 1].id; return [...prev, ...newMsgs]; } return prev; });
      }
    } catch { }
  }

  useEffect(() => { fetchMsgs(0); pollRef.current = setInterval(() => fetchMsgs(lastIdRef.current), 3000); return () => clearInterval(pollRef.current); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function sendMsg() {
    if (!inp.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, sender_id: user?.id, sender_name: user?.name, sender_role: 'buyer_seller', message: inp.trim(), listing_id: listing.id, seller_id: listing.user_id, buyer_id: user?.id, buyer_name: user?.name }) });
      setInp(''); await fetchMsgs(lastIdRef.current);
    } catch { addAlert('Failed to send message', 'error'); }
    setSending(false);
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Chat /> Chat with Seller — UPI: {listing?.upi}</span>
          <button onClick={onBack} className="btn-back-small">← Back</button>
        </div>
        <div style={{ height: 340, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.length === 0 && <div style={{ color: '#4d7c77', fontSize: 13, textAlign: 'center', marginTop: 60 }}>No messages yet. Start negotiating!</div>}
          {msgs.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: String(m.sender_id) === String(user?.id) ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '9px 13px', borderRadius: String(m.sender_id) === String(user?.id) ? '14px 3px 14px 14px' : '3px 14px 14px 14px', background: String(m.sender_id) === String(user?.id) ? 'linear-gradient(135deg,#0d9488,#0891b2)' : 'var(--teal-l)', color: String(m.sender_id) === String(user?.id) ? 'white' : '#0c1a19', fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontSize: 10, opacity: .7, marginBottom: 3, fontWeight: 600 }}>{m.sender_name} {String(m.sender_id) === String(user?.id) ? '(You)' : '(Seller)'}</div>
                {m.message}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--g200)', display: 'flex', gap: 8 }}>
          <input className="s-inp" style={{ flex: 1, padding: '10px 14px' }} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()} placeholder="Type your message to the seller…" />
          <button className="btn-p" onClick={sendMsg} disabled={sending || !inp.trim()}><Ic.Send /></button>
        </div>
      </div>
    </div>
  );
}

// ── Seller Chat ────────────────────────────────────────────
function ViewSellerChat({ user, chatInfo, onBack, addAlert }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const lastIdRef = useRef(0);
  const room = chatInfo.room;

  async function fetchMsgs(sinceId = 0) {
    try {
      const r = await fetch(`${API}/chat/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, since_id: sinceId }) });
      const d = await r.json();
      if (d.success && d.messages?.length > 0) {
        setMsgs(prev => { const existingIds = new Set(prev.map(m => m.id)); const newMsgs = d.messages.filter(m => !existingIds.has(m.id)); if (newMsgs.length > 0) { lastIdRef.current = newMsgs[newMsgs.length - 1].id; return [...prev, ...newMsgs]; } return prev; });
      }
    } catch { }
  }

  useEffect(() => { fetchMsgs(0); pollRef.current = setInterval(() => fetchMsgs(lastIdRef.current), 3000); return () => clearInterval(pollRef.current); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function sendMsg() {
    if (!inp.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, sender_id: user?.id, sender_name: user?.name, sender_role: 'seller', message: inp.trim() }) });
      setInp(''); await fetchMsgs(lastIdRef.current);
    } catch { addAlert('Failed to send', 'error'); }
    setSending(false);
  }

  return (
    <div className="view">
      <div className="card">
        <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Chat /> Replying to {chatInfo.buyerName} — UPI: {chatInfo.listing?.upi}</span>
          <button onClick={onBack} className="btn-back-small">← Back</button>
        </div>
        <div style={{ height: 380, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {msgs.length === 0 && <div style={{ color: '#4d7c77', fontSize: 13, textAlign: 'center', marginTop: 60 }}>No messages yet.</div>}
          {msgs.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: String(m.sender_id) === String(user?.id) ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '9px 13px', borderRadius: String(m.sender_id) === String(user?.id) ? '14px 3px 14px 14px' : '3px 14px 14px 14px', background: String(m.sender_id) === String(user?.id) ? 'linear-gradient(135deg,#0d9488,#0891b2)' : 'var(--teal-l)', color: String(m.sender_id) === String(user?.id) ? 'white' : '#0c1a19', fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontSize: 10, opacity: .7, marginBottom: 3, fontWeight: 600 }}>{m.sender_name} {String(m.sender_id) === String(user?.id) ? '(You)' : '(Buyer)'}</div>
                {m.message}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--g200)', display: 'flex', gap: 8 }}>
          <input className="s-inp" style={{ flex: 1, padding: '10px 14px' }} value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()} placeholder="Reply to buyer…" />
          <button className="btn-p" onClick={sendMsg} disabled={sending || !inp.trim()}><Ic.Send /></button>
        </div>
      </div>
    </div>
  );
}

// ── My Mutations ───────────────────────────────────────────
function ViewMutations({ user }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/transactions/mine`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user?.id }) })
      .then(r => r.json()).then(d => { if (d.success) setTxs(d.transactions || []); })
      .catch(() => { }).finally(() => setLoading(false));
  }, []);
  const statusColor = s => ({ approved: '#10b981', pending: '#f59e0b', rejected: '#ef4444' }[s] || '#94a3b8');
  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Shield /> My Mutations ({txs.length})</div>
        {loading && <div className="loading-state"><Ic.Spin /> Loading…</div>}
        {!loading && txs.length === 0 && <div className="empty-state">No mutations yet.</div>}
        {!loading && txs.map(t => (
          <div key={t.id} className="listing-row">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0d9488', fontSize: 13 }}>{t.reference}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(t.status) }}>● {t.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#4d7c77', fontFamily: 'monospace' }}>{t.upi}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}> <strong>{t.seller_name}</strong> → <strong>{t.buyer_name}</strong>  &nbsp;|&nbsp; {fmt(t.agreed_price)}</div>
              <div style={{ fontSize: 11, color: '#4d7c77', marginTop: 2 }}>{fmtDate(t.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Suggestions ────────────────────────────────────────────
function ViewSuggest({ user, addAlert }) {
  const [form, setForm] = useState({ message: '', rating: 5 });
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!form.message.trim()) { addAlert('Please write a message', 'error'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/suggestions/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: form.message, rating: form.rating, user_id: user?.id, user_name: user?.name, category: 'general' }) });
      const d = await r.json();
      if (d.success) { addAlert('Suggestion submitted! Thank you.', 'success'); setForm({ message: '', rating: 5 }); }
      else addAlert(d.message || 'Failed to submit', 'error');
    } catch { addAlert('Cannot connect to server', 'error'); }
    setLoading(false);
  }
  return (
    <div className="view">
      <div className="card">
        <div className="card-hd"><Ic.Suggest /> Submit a Suggestion</div>
        <div style={{ padding: '16px 20px' }}>
          <div className="form-group">
            <label className="form-label">Rating</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setForm(f => ({ ...f, rating: n }))} style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', padding: 0 }}>
                  <span style={{ color: n <= form.rating ? '#f59e0b' : 'rgba(0,0,0,.15)' }}>★</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group"><label className="form-label">Your Message *</label><textarea className="f-inp" rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell us what you think about the system…" /></div>
          <button className="btn-pred" onClick={submit} disabled={loading}>
            {loading ? <><Ic.Spin /> Sending…</> : <><Ic.Send /> Submit Suggestion</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════
export default function BuyerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState({ listings: 0, mutations: 0, approved: 0, estimates: 0, parcels: 0 });
  const [notifListings, setNotifListings] = useState([]);
  const [bellSnapshot, setBellSnapshot] = useState([]);
  const [seenListingIds, setSeenListingIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('lpes_seen_listings') || '[]')); }
    catch { return new Set(); }
  });
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);
  const bellBtnRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const userMenuRef = useRef(null);

  // ── Profile photo state (persisted per user in localStorage) ──
  const [profilePhoto, setProfilePhoto] = useState(null);
  const photoInputRef = useRef(null);

  const [buyerChatTarget, setBuyerChatTarget] = useState(null);
  const [sellerChatInfo, setSellerChatInfo] = useState(null);
  const [saleFormTarget, setSaleFormTarget] = useState(null);
  const [notaryTarget, setNotaryTarget] = useState(null);

  // Load photo once user is known
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`lpes_photo_${user.id}`);
      if (saved) setProfilePhoto(saved);
    }
  }, [user?.id]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Listen for price history navigation from My Parcels
  useEffect(() => {
    function handleViewPriceHistory() {
      clearAll();
      setActive('history');
    }
    window.addEventListener('viewPriceHistory', handleViewPriceHistory);
    return () => window.removeEventListener('viewPriceHistory', handleViewPriceHistory);
  }, []);

  // Fetch public listings for bell
  useEffect(() => {
  if (!user?.id) return;
  function fetchListings() {
    fetch(`${API}/listings/all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem('lpes_seen_listings') || '[]')); } catch { return new Set(); } })();
          const others = (d.listings || []).filter(l => String(l.user_id) !== String(user.id) && !l.is_agreed && !seen.has(`${l.id}_${l.updated_at || l.created_at}`));
          setNotifListings(others);
        }
      }).catch(() => {});
  }
  fetchListings();
  const interval = setInterval(fetchListings, 30000);
  return () => clearInterval(interval);
}, [user]);

  useEffect(() => {
  if (!user?.id) return;
  
  // Fetch parcels count first and update stats
  fetch(`${API}/user/parcels`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ user_id: user.id }) 
  })
    .then(r => r.json())
    .then(d => { 
      if (d.success) {
        const parcelsCount = (d.parcels || []).length;
        setStats(prev => ({ ...prev, parcels: parcelsCount }));
      }
    })
    .catch(() => {});
    
  // Fetch other stats
  fetch(`${API}/buyer/stats`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ user_id: user.id }) 
  })
    .then(r => r.json())
    .then(d => { 
      if (d.success) {
        setStats(prev => ({ ...prev, ...d.stats }));
      }
    })
    .catch(() => {});
}, [user]);

  if (!user) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f0fdfa' }}>
      <div style={{ color: '#0d9488', fontFamily: '"Times New Roman",Times,serif', fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}><Ic.Spin /> Loading…</div>
    </div>
  );

  function doLogout() { localStorage.removeItem('lpe_user'); router.push('/'); }
  function clearAll() { setBuyerChatTarget(null); setSellerChatInfo(null); setSaleFormTarget(null); setNotaryTarget(null); }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { addAlert('Photo must be under 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target.result;
      setProfilePhoto(data);
      localStorage.setItem(`lpes_photo_${user.id}`, data);
      addAlert('Profile photo updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  // Avatar initials helper
  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || 'U';

  function renderContent() {
    if (notaryTarget) {
      return <ViewNotaryRequest user={user} agreement={notaryTarget} addAlert={addAlert}
        onRequestSent={ag => { setNotaryTarget(null); setSaleFormTarget(null); setActive('agreements'); addAlert(`Notary request sent to ${ag.notary_name}!`, 'success'); }}
        onBack={() => { setNotaryTarget(null); setSaleFormTarget(notaryTarget); }} />;
    }
    if (saleFormTarget) {
      if (saleFormTarget.skipToNotary) {
        return <ViewNotaryRequest user={user} agreement={saleFormTarget} addAlert={addAlert}
          onRequestSent={() => { setNotaryTarget(null); setSaleFormTarget(null); setActive('agreements'); }}
          onBack={() => { setSaleFormTarget(null); setActive('agreements'); }} />;
      }
      return <ViewSaleForm user={user} agreement={saleFormTarget} addAlert={addAlert}
        onFormSubmitted={ag => { setSaleFormTarget(null); setNotaryTarget(ag); }}
        onBack={() => { setSaleFormTarget(null); setActive('agreements'); }} />;
    }
    if (sellerChatInfo) return <ViewSellerChat user={user} chatInfo={sellerChatInfo} onBack={() => setSellerChatInfo(null)} addAlert={addAlert} />;
    if (buyerChatTarget) return <ViewChat user={user} listing={buyerChatTarget} onBack={() => setBuyerChatTarget(null)} addAlert={addAlert} />;

    switch (active) {
      case 'dashboard': return <ViewDashboard setActive={id => { clearAll(); setActive(id); }} stats={stats} />;
      case 'predict': return <ViewPredict user={user} addAlert={addAlert} />;
      case 'history': return <ViewHistory user={user} addAlert={addAlert} />;
      case 'my-publications': return <ViewMyPublications user={user} addAlert={addAlert} onSellerChatClick={info => setSellerChatInfo(info)} />;
      case 'public-listings': return <ViewPublicListings user={user} addAlert={addAlert} onChatClick={listing => setBuyerChatTarget(listing)} />;
      case 'agreements': return <ViewAgreements user={user} addAlert={addAlert} onFillForm={ag => { clearAll(); setSaleFormTarget(ag); }} />;
      case 'mutations': return <ViewMutations user={user} />;
      case 'suggest': return <ViewSuggest user={user} addAlert={addAlert} />;
      case 'my-parcels': return <ViewMyParcels user={user} addAlert={addAlert} />;
      default: return <ViewDashboard setActive={setActive} stats={stats} />;
    }
  }

  const TITLES = { dashboard: 'My Dashboard', predict: 'Predict Price', history: 'Price History', 'my-publications': 'My Publications', 'public-listings': 'All Publications', agreements: 'Agreements', mutations: 'My Mutations', suggest: 'Suggestions', 'my-parcels': 'My Parcels' };

  return (
    <>
      <Head>
        <title>{TITLES[active] || 'Dashboard'} — LPES</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&display=swap" rel="stylesheet" />
      </Head>

      <ToastContainer alerts={alerts} removeAlert={removeAlert} />

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
      
      {/* Hidden photo input — triggered from profile dropdown */}
      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

      <style>{`
  :root{
    --teal:#0d9488;--teal-d:#0f766e;--teal-l:#f0fdfa;
    --cyan:#0891b2;--dark:#0c1a19;
    --g200:#ccf2ee;--g300:#99e6de;--g600:#4d7c77;
    --sh-sm:0 1px 3px rgba(13,148,136,.12);
    --sh-md:0 4px 12px rgba(13,148,136,.16);
    --sh-lg:0 10px 30px rgba(13,148,136,.20);
    --sh-xl:0 20px 50px rgba(13,148,136,.24);
    --r:12px;--rl:16px;--rxl:22px;
    --sb-w:260px;--nav:#0f172a;
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Times New Roman",Times,serif;background:#f0fdfa;color:#0c1a19}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes mIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .shell{display:flex;flex-direction:column;height:100vh;overflow:hidden}
  .shell-body{display:flex;flex:1;overflow:hidden;min-height:0}
  .topbar{height:60px;background:var(--nav);display:flex;align-items:center;flex-shrink:0;z-index:200;border-bottom:1px solid rgba(255,255,255,.07);padding:0;overflow:visible;}
  .topbar-brand{width:var(--sb-w);flex-shrink:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;background:#00102a;border-bottom:3px solid white;border-radius:0 0 10px 10px;}
  .topbar-brand-acronym{font-size:20px;font-weight:800;color:#60a5fa;font-family:"Times New Roman",Times,serif;letter-spacing:5px;font-style:italic;line-height:1.2;text-align:center;}
  .topbar-brand-tagline{font-size:9px;color:rgba(255,255,255,.6);font-family:"Times New Roman",Times,serif;margin-top:4px;text-align:center;letter-spacing:.1px;font-style:italic;}
  .topbar-expand-wrap{padding:0;flex-shrink:0;height:100%;}
  .topbar-expand-btn{display:flex;align-items:center;justify-content:center;height:100%;width:80px;background:white;border:none;border-right:1px solid #e5e7eb;color:#374151;cursor:pointer;transition:background .15s;border-radius:0;padding-top:6px;}
  .topbar-expand-btn:hover{background:#f3f4f6}
  .topbar-title{flex:1;font-size:14px;color:rgba(255,255,255,.65);font-family:"Times New Roman",Times,serif;font-style:italic;padding:0 16px;text-align:center;line-height:1.5;}
  .topbar-user-wrap{position:relative;padding:0;flex-shrink:0;}
  .topbar-user{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:6px 0 0 6px;background:white;border:1px solid #d1d5db;cursor:pointer;user-select:none;transition:background .18s;color:#1f2937;}
  .topbar-user:hover{background:#f9fafb}
  .topbar-user-avatar{width:28px;height:28px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:800;flex-shrink:0;}
  .topbar-user-name{font-size:13px;font-weight:600;color:#1f2937;font-family:"Times New Roman",Times,serif;}
  .topbar-sep{color:#9ca3af;font-size:13px;margin:0 2px}
  .topbar-role{color:#6b7280;font-size:13px;font-family:"Times New Roman",Times,serif}
  .topbar-chev{color:#6b7280;display:flex;align-items:center;margin-left:4px}

  /* ── User Dropdown ── */
  .user-dropdown{
  position:absolute;top:calc(100% + 6px);
  left:50%;
  transform:translateX(-50%);
  width:240px;
  background:white;border-radius:14px;
  box-shadow:0 12px 36px rgba(0,0,0,.18);
  border:1px solid var(--g200);overflow:hidden;z-index:500;
}
  .ud-header{padding:12px 16px 10px;border-bottom:1px solid var(--g200);text-align:center;}
  .ud-avatar-wrap{position:relative;width:52px;height:52px;margin:0 auto 7px;cursor:pointer;}
  .ud-avatar-wrap:hover .ud-cam-overlay{opacity:1;}
  .ud-avatar-img{width:52px;height:52px;border-radius:50%;object-fit:cover;border:2.5px solid #0d9488;display:block;}
  .ud-avatar-init{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0891b2);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:800;}
  .ud-cam-overlay{
    position:absolute;inset:0;border-radius:50%;
    background:rgba(0,0,0,.45);display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:2px;
    opacity:0;transition:opacity .2s;pointer-events:none;
  }
  .ud-cam-overlay span{font-size:8px;color:white;font-weight:700;letter-spacing:.3px;}
  .ud-cam-btn{position:absolute;inset:0;border-radius:50%;background:transparent;border:none;cursor:pointer;width:100%;height:100%;}
  .ud-badge{width:18px;height:18px;border-radius:50%;background:#0d9488;border:2px solid white;display:flex;align-items:center;justify-content:center;position:absolute;bottom:0px;right:0px;}
  .ud-name{font-weight:800;font-size:13px;color:#0c1a19;font-family:"Times New Roman",Times,serif;}
  .ud-role{font-size:10px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;margin-top:1px;}
  .ud-email{font-size:11px;color:#4d7c77;margin-top:4px;}
  .ud-phone{font-size:11px;color:#4d7c77;margin-top:2px;}
  .ud-hint{font-size:9px;color:#9ca3af;margin-top:5px;font-style:italic;}
  .ud-signout{
    display:flex;align-items:center;justify-content:center;gap:8px;
    width:100%;padding:10px 16px;background:none;border:none;border-top:1px solid var(--g200);
    cursor:pointer;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;
    color:#ef4444;transition:background .15s;
  }
  .ud-signout:hover{background:#fee2e2;color:#dc2626;outline:1.5px solid #ef4444;}

  /* ── Bell Panel ── */
  .bell-panel{
  position:absolute;top:0;right:calc(100% + 10px);left:auto;
  transform:none;
  background:white;border-radius:10px;
  border:1px solid #e5e7eb;box-shadow:0 8px 24px rgba(0,0,0,.18);
  z-index:9999;padding:10px 16px;width:auto;min-width:max-content;animation:mIn .18s ease both;
}
.bell-panel::after{
  content:'';position:absolute;top:14px;right:-9px;left:auto;
  transform:none;
  border:5px solid transparent;border-left-color:white;
}
  .bell-panel-hd{display:none;}
  .bell-panel-count{display:none;}
  .bell-panel-body{display:block;}
  .bell-panel-body::-webkit-scrollbar{display:none;}
  .bell-item{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;border-bottom:1px solid #f3f4f6;}
  .bell-item:last-child{border-bottom:none;}
  .bell-item:hover{opacity:.8;}
  .bell-item-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:4px;animation:pulse 1.5s infinite;}
  .bell-item-upi{font-family:monospace;font-weight:700;font-size:11px;color:#0d9488;}
  .bell-item-price{font-size:10px;color:#374151;margin-top:1px;}
  .bell-item-seller{font-size:10px;color:#9ca3af;margin-top:1px;}
  .bell-view-all{padding:6px 0 0;font-size:10px;color:#0d9488;font-weight:700;cursor:pointer;border-top:1px solid #f3f4f6;margin-top:4px;text-align:center;font-family:"Times New Roman",Times,serif;}
  .bell-view-all:hover{opacity:.8;}
  .bell-empty{font-size:12px;color:#374151;font-family:"Times New Roman",Times,serif;font-weight:600;white-space:nowrap;padding:2px 0;}
  .bell-btn{position:relative;}
  .bell-btn .bell-tooltip{
    position:absolute;top:calc(100% + 13px);left:50%;transform:translateX(-50%);
    background:#0c1a19;color:white;font-size:11px;font-weight:600;
    white-space:nowrap;padding:5px 10px;border-radius:8px;
    font-family:"Times New Roman",Times,serif;
    pointer-events:none;opacity:0;transition:opacity .2s;
    box-shadow:0 4px 12px rgba(0,0,0,.2);
  }
  .bell-btn .bell-tooltip::before{
    content:'';position:absolute;bottom:100%;left:50%;transform:translateX(-50%);
    border:5px solid transparent;border-bottom-color:#0c1a19;
  }
  .bell-btn:hover .bell-tooltip{opacity:1;}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}

  .sidebar{width:var(--sb-w);background:var(--nav);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.24s cubic-bezier(0.4,0,0.2,1);border-right:1px solid rgba(255,255,255,.06);overflow:visible;white-space:nowrap;}
  .sidebar-open{width:var(--sb-w);}.sidebar-closed{width:0;}
  .sb-nav{flex:1;padding:14px 10px;overflow-y:auto;overflow-x:hidden}
  .sb-section{font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;padding:0 8px 10px;letter-spacing:.6px;white-space:nowrap}
  .sb-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:10px;background:transparent;border:none;color:rgba(255,255,255,.6);font-size:13px;font-weight:500;cursor:pointer;margin-bottom:3px;font-family:"Times New Roman",Times,serif;text-align:left;transition:all .18s;white-space:nowrap}
  .sb-item:hover{background:rgba(255,255,255,.06);color:white}.sb-item.active{background:rgba(13,148,136,.2);color:#0d9488}
  .sb-icon{display:flex;align-items:center;flex-shrink:0}.sb-label{flex:1}.sb-pip{width:5px;height:5px;border-radius:50%;background:#0d9488;flex-shrink:0}
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .content{flex:1;overflow-y:auto;padding:24px;padding-bottom:40px;}
  .content::-webkit-scrollbar{width:5px}.content::-webkit-scrollbar-thumb{background:#0d9488;border-radius:3px}
  .view{display:flex;flex-direction:column;gap:18px;max-width:1100px;margin:0 auto;width:100%;padding-bottom:20px;}
  .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
  .stat-card{background:white;border:1px solid var(--g200);border-radius:var(--rxl);padding:18px;box-shadow:var(--sh-sm)} .stat-card.clickable:hover{transform:translateY(-2px);box-shadow:var(--sh-md);border-color:var(--teal);cursor:pointer}
  .stat-value{font-size:30px;font-weight:800;color:#0c1a19}.stat-label{font-size:13px;font-weight:600;margin-top:4px}.stat-sub{font-size:11px;color:#4d7c77;margin-top:2px}
  .section-label{font-size:11px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
  .qa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .qa-card{background:white;border:1.5px solid var(--g200);border-radius:var(--rxl);padding:18px;cursor:pointer;text-align:left;transition:all .2s;font-family:"Times New Roman",Times,serif}
  .qa-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:var(--sh-md)}
  .qa-dot{width:10px;height:10px;border-radius:50%;margin-bottom:8px}.qa-label{font-size:14px;font-weight:700}.qa-desc{font-size:12px;color:#4d7c77;margin-top:4px}
  .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:visible;animation:fadeUp .4s ease}
  .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:14px 20px;font-family:"Times New Roman",Times,serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;border-radius:var(--rxl) var(--rxl) 0 0}
  .upi-bdg{background:rgba(255,255,255,.2);border-radius:50px;padding:3px 12px;font-size:12px;margin-left:auto}
  .btn-pub {
   display: flex;
   align-items: center;
   gap: 6px;
   padding: 8px 16px;
   font-size: 13px;
   font-weight: 700;
   font-family: "Times New Roman", Times, serif;
   background: #ffffff; /* white background */
   color: #000000; /* black text */
   border: 1px solid #ccc; /* optional: adds visibility */
   border-radius: var(--rl);
   cursor: pointer;
   transition: all .22s;
   white-space: nowrap;
   box-shadow: var(--sh-sm);
  }
  .btn-pub:hover{transform:translateY(-1px);box-shadow:var(--sh-md)}
  .s-row{display:flex;gap:10px;padding:16px 20px 8px}
  .s-inp{flex:1;padding:12px 16px;font-size:14px;font-family:"Times New Roman",Times,serif;border:1.5px solid var(--g200);border-radius:var(--rl);outline:none;transition:all .22s;background:white}
  .s-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1)}
  .s-hint{padding:3px 20px 12px;font-size:12px;color:var(--g600);display:flex;align-items:center;gap:5px}
  .btn-p{display:flex;align-items:center;gap:7px;padding:11px 18px;font-size:14px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap}
  .btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:var(--sh-md)}.btn-p:disabled{opacity:.7;cursor:not-allowed}
  .btn-back-small{background:none;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px;color:white;font-family:"Times New Roman",Times,serif}
  .btn-back-small:hover{background:rgba(255,255,255,.15)}
  .alert-e{margin:0 20px 12px;background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:var(--r);padding:10px 14px;font-size:13px}
  .d-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:14px 18px}
  .d-sec{background:var(--teal-l);border-radius:var(--rl);padding:12px;border:1px solid var(--g200)}
  .d-sec-title{font-size:12px;font-weight:700;color:var(--teal);margin-bottom:8px;display:flex;align-items:center;gap:5px}
  .d-cols{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}
  .data-field{margin-bottom:4px}.data-label{font-size:10px;color:var(--g600);font-weight:600;text-transform:uppercase;letter-spacing:.4px}.data-value{font-size:13px;color:var(--dark);font-weight:600}
  .btn-pred{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px 20px 16px;width:calc(100% - 40px);padding:13px;font-size:15px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#7c3aed,#0d9488);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .3s}
  .btn-pred:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.3)}.btn-pred:disabled{opacity:.7;cursor:not-allowed}
  .pred-info{margin:12px 20px 8px;padding:10px;background:var(--teal-l);border-radius:var(--r);font-size:13px;color:var(--g600);display:flex;align-items:center;gap:7px}
  .p-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;padding:0 18px 16px}
  .price-card{border-radius:var(--rl);padding:16px;text-align:center;border:2px solid var(--g200)}
  .price-card.minimum{background:#f0fdf4;border-color:#86efac}.price-card.average{background:#eff6ff;border-color:#93c5fd}.price-card.maximum{background:#fef3c7;border-color:#fcd34d}
  .price-label{font-size:11px;font-weight:700;color:var(--g600);text-transform:uppercase;margin-bottom:5px}
  .price-total{font-size:16px;font-weight:800;color:var(--dark);margin-bottom:3px}
  .price-sqm{font-size:12px;color:var(--g600);margin-bottom:6px}.price-tax{font-size:12px}.no-tax{color:#16a34a;font-weight:600}
  .model-note{padding:0 20px 16px;font-size:12px;color:var(--g600);display:flex;align-items:center;gap:6px}
  .tax-notice{display:flex;align-items:center;gap:10px;background:#fefce8;border:1px solid #fde047;border-left:4px solid #f59e0b;border-radius:var(--r);padding:11px 14px;font-size:13px}
  .tn-icon{color:#f59e0b;flex-shrink:0;display:flex}
  .listing-row{display:flex;align-items:center;gap:12px;padding:14px 20px;border-top:1px solid var(--g200)}
  .buy-row:hover{background:var(--teal-l)}
  .listing-upi{font-family:monospace;font-size:12px;font-weight:700;color:#4d7c77}.listing-upi.teal{color:#0d9488}
  .listing-price{font-size:16px;font-weight:800;margin-top:3px}.listing-desc{font-size:12px;color:#4d7c77;margin-top:4px}
  .status-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:50px}.status-badge.active{color:#10b981;background:rgba(16,185,129,.1)}
  .btn-del{padding:6px 10px;border-radius:8px;border:1.5px solid #fecaca;background:rgba(239,68,68,.06);color:#ef4444;cursor:pointer}
  .search-wrap-inline{display:flex;align-items:center;gap:6px;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);padding:6px 12px}
  .s-inp-sm{border:none;background:transparent;outline:none;font-size:13px;font-family:"Times New Roman",Times,serif;width:180px}
  .info-banner{display:flex;gap:12px;align-items:center;background:var(--teal-l);border:1px solid var(--g200);border-radius:var(--rl);padding:12px 16px;margin-bottom:14px;font-size:13px}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .form-group{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
  .form-label{font-size:10px;font-weight:700;color:#4d7c77;text-transform:uppercase;letter-spacing:.4px}
  .f-inp{padding:11px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%}
  .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white}
  textarea.f-inp{resize:vertical}
  .upload-zone{border:1.5px dashed var(--g300);border-radius:var(--rl);padding:16px;text-align:center;cursor:pointer;transition:all .2s;background:white}
  .upload-zone:hover{border-color:var(--teal);background:rgba(13,148,136,.03)}
  .empty-state{padding:32px;text-align:center;color:#4d7c77;font-size:14px}
  .loading-state{display:flex;align-items:center;justify-content:center;gap:10px;padding:40px;color:#4d7c77}
  .m-overlay{position:fixed;inset:0;background:rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px}
  .m-box{background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);width:100%;max-width:420px;padding:26px;position:relative}
  .m-animate{animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both}
  .x-close-btn{background:none;border:none;cursor:pointer;color:#6b7280;display:flex;align-items:center;padding:6px;border-radius:6px;transition:color .15s,background .15s}
  .x-close-btn:hover{color:#ef4444;background:rgba(239,68,68,.1)}
  .logout-btn{transition:background .2s,transform .15s} .logout-btn:hover{background:#dc2626 !important;transform:translateY(-1px)}
  @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
  @media(max-width:768px){.stats-grid{grid-template-columns:1fr 1fr}.qa-grid{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}}
`}</style>

      <div className="shell">
        <div className="topbar">
          {/* Brand */}
          <div className="topbar-brand">
            <div className="topbar-brand-acronym">L P E S</div>
            <div className="topbar-brand-tagline">Land Price Estimation System</div>
          </div>

          {/* Sidebar toggle */}
          <div className="topbar-expand-wrap">
            <button className="topbar-expand-btn" onClick={() => setSidebarOpen(o => !o)}>
              <Ic.Menu />
            </button>
          </div>

          {/* Title */}
          <div className="topbar-title">
          A Machine Learning-Based Framework for Land Price<br />
          Estimation System
          </div>

          {/* ── Bell Notification ── */}
<div style={{ position: 'relative', marginLeft: 'auto', marginRight: 10, flexShrink: 0 }} ref={bellRef}>
  <button
  ref={bellBtnRef}
  onClick={() => {
  const isOpening = !bellOpen;
  setBellOpen(o => !o);
  if (isOpening) {
    setBellSnapshot(notifListings); // snapshot what's visible in panel
    if (notifListings.length > 0) {
      const newSeen = new Set([...seenListingIds, ...notifListings.map(l => `${l.id}_${l.updated_at || l.created_at}`)]);
      setSeenListingIds(newSeen);
      localStorage.setItem('lpes_seen_listings', JSON.stringify([...newSeen]));
      setNotifListings([]); // clear red dot immediately
    }
  }
}}
  className="bell-btn"
    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', background: 'white', border: `1.5px solid ${bellOpen ? '#0d9488' : '#d1d5db'}`, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'border-color .15s' }}>
    <Ic.Bell />
    {notifListings.length > 0 && !bellOpen && (
  <span style={{ position: 'absolute', top: -3, right: -3, width: 11, height: 11, borderRadius: '50%', background: '#ef4444', border: '2.5px solid #0f172a', animation: 'pulse 1.5s infinite' }} />
)}
    {!bellOpen && (
      <span className="bell-tooltip">
        {notifListings.length === 0 ? 'No new UPI published' : `${notifListings.length} UPI published`}
      </span>
    )}
  </button>

  {bellOpen && (
  <div className="bell-panel">
    {bellSnapshot.length === 0 ? (
      <div className="bell-empty">No new listings available</div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0d9488', fontFamily: '"Times New Roman",Times,serif' }}>
          {bellSnapshot.length} UPI{bellSnapshot.length > 1 ? 's' : ''} published
        </span>
        <span
          style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', cursor: 'pointer', fontFamily: '"Times New Roman",Times,serif', flexShrink: 0 }}
          onClick={() => { setBellOpen(false); clearAll(); setActive('public-listings'); }}>
          View all listings →
        </span>
      </div>
    )}
  </div>
)}
</div>

          {/* ── User Menu ── */}
          <div className="topbar-user-wrap" ref={userMenuRef} style={{ paddingRight: 16, paddingLeft: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="topbar-user" onClick={() => setUserMenuOpen(o => !o)}>
              {/* Small avatar in topbar */}
              <div className="topbar-user-avatar">
                {profilePhoto
                  ? <img src={profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }
              </div>
              <span className="topbar-user-name">{user?.name}</span>
              <span className="topbar-sep">|</span>
              <span className="topbar-role">Buyer / Seller</span>
              <span className="topbar-chev"><Ic.ChevDown /></span>
            </div>

            {userMenuOpen && (
              <div className="user-dropdown">
                {/* Header with avatar + info */}
                <div className="ud-header">
                  {/* Avatar with camera overlay */}
                  <div className="ud-avatar-wrap" onClick={() => photoInputRef.current?.click()} title="Click to change profile photo">
                    {profilePhoto
                      ? <img src={profilePhoto} alt="avatar" className="ud-avatar-img" />
                      : <div className="ud-avatar-init">{initials}</div>
                    }
                    {/* Camera hover overlay */}
                    <div className="ud-cam-overlay">
                      <Ic.Camera />
                      <span>Change</span>
                    </div>
                    {/* Camera badge bottom-right */}
                    <div className="ud-badge">
                      <Ic.Upload />
                    </div>
                  </div>

                  <div className="ud-name">{user?.name}</div>
                  <div className="ud-role">Buyer / Seller</div>
                  {user?.email && <div className="ud-email">{user.email}</div>}
                  {user?.phone && <div className="ud-phone">{user.phone}</div>}
                </div>

                {/* Sign out */}
                <button className="ud-signout" onClick={() => { setUserMenuOpen(false); setLogoutConfirm(true); }}>
                  <Ic.Logout /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="shell-body">
          <Sidebar active={active} sidebarOpen={sidebarOpen} setActive={id => { clearAll(); setActive(id); }} user={user} />
          <div className="main">
            <div className="content">
              {renderContent()}
            </div>
          </div>
        </div>

        {/* ── Floating AI Chatbot (bottom-right circle) ── */}
        <Chatbot user={user} />
      </div>
    </>
  );
}