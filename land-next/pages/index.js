import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

async function apiPost(path, body) {
  const res = await fetch(`https://land-price-api-35fr.onrender.com${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const T = {
  en: {
    title: 'Land Price Estimation System',
    tagline: 'A Machine Learning - Powered Land Estimation and Tax Calculation System',
    polytechnic: 'RWANDA', college: 'SOUTHERN PROVINCE',
    dept: 'HUYE DISTRICT', program: 'HUYE & MBAZI SECTORS',
    taxNote: 'A Machine Learning-Based Framework for Land Price Estimation',
    searchTitle: 'Use the Search Button Below to Enter the UPI', searchPlaceholder: 'e.g. xx/xx/xx/xx/xxxx',
    searchBtn: 'Search', searchHint: 'Use Unique Parcel Identifier',
    landData: 'Land Data', basicInfo: 'Basic Information',
    province: 'Province', district: 'District', sector: 'Sector', cell: 'Cell', village: 'Village',
    location: 'Location & Area', xCoord: 'X Coordinate', yCoord: 'Y Coordinate', area: 'Area (m²)',
    zoning: 'Zoning & Classification', zoningLabel: 'Zoning', zoningPct: 'Zoning %',
    settlement: 'Settlement', settlementPct: 'Settlement %', landUse: 'Land Use',
    values: 'Market Values (RWF)', minSqm: 'Min / m²', avgSqm: 'Avg / m²', maxSqm: 'Max / m²',
    getPred: 'Estimate Land Price', predTitle: 'Estimated Land Price',
    predInfo: 'Estimated Prices: Minimum, Average and Maximum',
    minEst: 'Minimum', avgEst: 'Average', maxEst: 'Maximum',
    tax: 'Tax:', noTax: 'No Tax (below 5M RWF)', perSqm: '/m²',
    modelNote: 'A 2.5% Tax Applies Only to the Price Above 5,000,000 RWF',
    footer: 'Rwanda Polytechnic — Huye College',
    footerSub: 'ICT Department | Land Price Estimation System',
    footerTech: 'Powered by Machine Learning',
    chatTitle: 'System Assistant', chatSub: 'Do you have any questions?',
    chatGreeting: 'I\'m your assistant.',
    qa1: 'How to use?', qa2: 'UPI format?', qa3: 'Tax info?', qa4: 'Estimation?',
    chatPlaceholder: 'Type a message…',
    resetTitle: 'Start New Chat?', resetMsg: 'This will clear the conversation.',
    cancel: 'Cancel', confirmReset: 'Yes, Reset',
    enterUPI: 'Please enter a UPI', notFound: 'Not Found',
    serverErr: 'Could not connect to the server.',
    predFailed: 'Prediction Failed', searchFirst: 'Please search for a UPI first',
    accountLabel: 'My Account', loginLabel: 'Login', langLabel: 'Language',
    loginTitle: 'Sign In', loginSubtitle: 'Welcome back! Enter your credentials.',
    emailLabel: 'Email', passwordLabel: 'Password', loginBtn: 'Login',
    forgotPassword: 'Forgot password?', noAccount: 'Create an account',
    orDivider: 'OR', googleBtn: 'Continue with Google',
    registerTitle: 'Create Account',
    step1Title: 'Personal Info', step2Title: 'Set Password',
    fullName: 'Full Name', phone: 'Phone', email: 'Email', nationalId: 'National ID',
    password: 'Password', confirmPassword: 'Confirm Password',
    nextBtn: 'Next', backBtn: 'Back', createAccountBtn: 'Create Account',
    alreadyAccount: 'Already have an account? Sign in',
    loggingIn: 'Signing in…', creatingAccount: 'Creating…',
    passwordMismatch: 'Passwords do not match.',
    passwordShort: 'Password must be at least 8 characters with letters and numbers.',
    forgotTitle: 'Forgot Password?', forgotSub: 'Enter your email or full name to receive a reset link.',
    sendResetBtn: 'Send Reset Link', sendingReset: 'Sending…',
    resetSentTitle: 'Reset Link Sent!', resetSentMsg: 'Check your email (valid 30 minutes).',
    backToSignIn: 'Back to Sign In',
  },
  rw: {
    title: 'Sisiteme yo Kugena Igiciro cy\'Ubutaka',
    tagline: 'Sisiteme Ikoresha Machine Learning mu Kugena Igiciro cy\'Ubutaka no Kubara Umusoro',
    polytechnic: 'RWANDA', college: 'INTARA Y\'AMAJYEPFO',
    dept: 'AKARERE KA HUYE', program: 'IMIRENGE YA HUYE NA MBAZI',
    taxNote: 'Sisiteme Ikoresha Ikoranabuhanga rya Machine Learning mu Kugena Igiciro cy\'Ubutaka',
    searchTitle: 'Shakisha Ukoresheje UPI', searchPlaceholder: 'urugero: xx/xx/xx/xx/xxxx',
    searchBtn: 'Shakisha', searchHint: 'Koresha Nomero Iranga Ubutaka (UPI)',
    landData: 'Amakuru y\'Ubutaka', basicInfo: 'Amakuru y\'Ibanze',
    province: 'Intara', district: 'Akarere', sector: 'Umurenge', cell: 'Akagari', village: 'Umudugudu',
    location: 'Aho Giherereye n\'Ubuso', xCoord: 'Korodone za X', yCoord: 'Korodone za Y', area: 'Ubuso (m²)',
    zoning: 'Imiterere y\'Ubutaka', zoningLabel: 'Zone', zoningPct: 'Igipimo %',
    settlement: 'Icyo Bwagenewe', settlementPct: 'Igipimo %', landUse: 'Icyo Bukoreshwa',
    values: 'Agaciro ku Isoko (RWF)', minSqm: 'Gato / m²', avgSqm: 'Ko Hagati / m²', maxSqm: 'Kinini / m²',
    getPred: 'Reba Ibiciro by\'Ubutaka', predTitle: 'Ibiciro by\'Ubutaka',
    predInfo: 'Ibiciro Byagereranijwe: Gito, Hagati, Kinini',
    minEst: 'Igiciro Gito', avgEst: 'Igiciro cyo Hagati', maxEst: 'Igiciro kinini',
    tax: 'Umusoro:', noTax: 'Nta musoro (munsi ya 5M RWF)', perSqm: '/m²',
    modelNote: 'Umusoro wa 2.5% Urakurikizwa kugiciro kirenze Miliyoni 5 RWF',
    footer: 'Kaminuza y\'Ikoranabuhanga — Ishuri Rikuru rya Huye',
    footerSub: 'Ishami ry\'Ikoranabuhanga | Sisiteme yo Kugena Igiciro cy\'Ubutaka',
    footerTech: 'Yifashishije Ikoranabuhanga rya Machine Learning',
    chatTitle: 'Ubufusha kuri Sisiteme', chatSub: 'Waba hari ikibazo?',
    chatGreeting: 'Ndi hano kugira ngo ngufashe.',
    qa1: 'Ikoreshwa ite?', qa2: 'Imiterere ya UPI?', qa3: 'Umusoro?', qa4: 'Ibiciro?',
    chatPlaceholder: 'Andika ubutumwa…',
    resetTitle: 'Tangira Ikiganiro Gishya?', resetMsg: 'Ibi biratangiza ikiganiro.',
    cancel: 'Reka', confirmReset: 'Yego, tangira',
    enterUPI: 'Nyabuneka injiza UPI', notFound: 'Ntibyabonetse',
    serverErr: 'Byanze guhuza na seriveri.',
    predFailed: 'Kubara Byanze', searchFirst: 'Nyamuneka shakisha UPI mbere',
    accountLabel: 'Konte yanjye', loginLabel: 'Kwinjira', langLabel: 'Ururimi',
    loginTitle: 'Kwinjira', loginSubtitle: 'Murakaza neza! Injiza amakuru yawe.',
    emailLabel: 'Imeri', passwordLabel: 'Ijambo Banga', loginBtn: 'Kwinjira',
    forgotPassword: 'Wibagiwe ijambo banga?', noAccount: 'Fungura konti',
    orDivider: 'CYANGWA', googleBtn: 'Komeza na Google',
    registerTitle: 'Fungura Konti',
    step1Title: 'Amakuru Yawe', step2Title: 'Ijambo Banga',
    fullName: 'Amazina Yuzuye', phone: 'Telefoni', email: 'Imeri', nationalId: 'Indangamuntu',
    password: 'Ijambo Banga', confirmPassword: 'Emeza Ijambo Banga',
    nextBtn: 'Komeza', backBtn: 'Garuka', createAccountBtn: 'Fungura Konti',
    alreadyAccount: 'Usanzwe ufite konti? Injira',
    loggingIn: 'Muri injira…', creatingAccount: 'Fungura…',
    passwordMismatch: 'Amagambo banga ntahuye.',
    passwordShort: 'Ijambo banga rigomba kuba nibura inyuguti 8 zirimo inyuguti na nimero.',
    forgotTitle: 'Wibagiwe Ijambo Banga?', forgotSub: 'Injiza imeri cyangwa amazina yawe tukoherereze ubutumwa.',
    sendResetBtn: 'Ohereza ubutumwa', sendingReset: 'Kohereza…',
    resetSentTitle: 'ubutumwa bwoherejwe!', resetSentMsg: 'Reba imeri yawe (burangira mu miminota 30).',
    backToSignIn: 'Garuka kwinjira',
  }
};

const fmt = n => Math.round(n).toLocaleString('en-US') + ' RWF';
const fmtNum = (n, d = 2) => parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function calcTax(price, t) {
  if (price <= 5000000) return <span className="no-tax">&#10003; {t.noTax}</span>;
  const tax = (price - 5000000) * 0.025;
  return <span>{t.tax} <strong>{fmt(tax)}</strong> (2.5%)</span>;
}

function DataField({ label, value }) {
  return (
    <div className="data-field">
      <div className="data-label">{label}</div>
      <div className="data-value">{value || '—'}</div>
    </div>
  );
}

function PriceCard({ type, label, price, perSqm, taxNode, t }) {
  return (
    <div className={`price-card ${type}`}>
      <div className="price-label">{label}</div>
      <div className="price-total">{fmt(price)}</div>
      <div className="price-sqm">{fmtNum(perSqm)} RWF{t.perSqm}</div>
      <div className="price-tax">{taxNode}</div>
    </div>
  );
}

/* ── SVG Icons ───────────────────────────────────────────── */
const Ic = {
  Globe: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Grad: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  PC:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Key:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>,
  Chev: ({ up }) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>,
  Eye:  ({ off }) => off
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  X:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:() => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Spin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:'spin .7s linear infinite',display:'inline-block'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Chat: () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Mail: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Lock: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  User: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Phone:() => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.49 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  ID:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Search:()=> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  MapPin:()=> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Tag:  () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Chart:() => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Info: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Brain:() => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.92-4.22z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.98-3 2.5 2.5 0 0 0 1.32-4.24 3 3 0 0 0-.34-5.58 2.5 2.5 0 0 0-1.92-4.22z"/></svg>,
};

/* ── Language Selector ──────────────────────────────────── */
function LangSelector({ lang, setLang, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0, width: '100%' }} ref={ref}>
      <button className={`tb-btn tb-clickable tb-grow ${open ? 'tb-btn-open' : ''}`} onClick={() => setOpen(o => !o)} style={{ width: '100%' }}>
        <span className="tb-icon-ring"><Ic.Globe /></span>
        <span className="tb-texts">
          <span className="tb-small">{t.langLabel}</span>
          <span className="tb-main">{lang === 'en' ? 'English' : 'Kinyarwanda'}</span>
        </span>
        <span className="tb-chev"><Ic.Chev up={open} /></span>
      </button>
      {open && (
        <div className="lang-drop">
          {['en', 'rw'].map(l => (
          <button key={l} className={`lang-opt ${lang === l ? 'lang-opt-on' : ''}`} onClick={() => { setLang(l); setOpen(false); }}>
          <span>{l === 'en' ? 'English' : 'Kinyarwanda'}</span>
          {lang === l && <span style={{color:'var(--teal)',fontWeight:800,fontSize:15}}>✓</span>}
          </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── LOGIN MODAL ────────────────────────────────────────── */
function LoginModal({ t, lang, onClose, onLoginSuccess, onSwitchToRegister }) {
  const [view, setView] = useState('login');
  const [un, setUn] = useState(''); const [pw, setPw] = useState(''); const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const [fpUser, setFpUser] = useState(''); const [fpLoad, setFpLoad] = useState(false); const [fpErr, setFpErr] = useState('');

  async function doLogin(e) {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const d = await (await fetch('https://land-price-api-35fr.onrender.com/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: un, password: pw }) })).json();
      setLoading(false);
      if (d.success) { sessionStorage.setItem('lpe_user', JSON.stringify(d.user)); onLoginSuccess(d.redirect || '/dashboard'); }
      else {
        const msg = d.message || '';
        if (lang === 'rw') {
          if (msg.includes('not found') || msg.includes('Email or Full name')) {
            setErr('Email yawe cyangwa ijambo banga sibyo');
          } else if (msg.includes('Invalid') || msg.includes('password') || msg.includes('Password')) {
            setErr('Email yawe cyangwa ijambo banga sibyo');
          } else {
            setErr(msg);
          }
        } else {
          setErr(msg);
        }
      }
    } catch { setLoading(false); setErr('Cannot connect to server.'); }
  }

  async function doForgot(e) {
    e.preventDefault(); setFpErr(''); setFpLoad(true);
    try {
      const d = await (await fetch('https://land-price-api-35fr.onrender.com/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: fpUser }) })).json();
      setFpLoad(false);
      if (d.success) setView('sent'); else setFpErr(d.message || 'No account found.');
    } catch { setFpLoad(false); setFpErr('Cannot connect to server.'); }
  }

  return (
    <div className="m-overlay">
      <div className="m-box m-animate">
        <button className="m-close" onClick={onClose}><Ic.X /></button>

        {view === 'login' && <>
          <div className="m-head">
            <div className="m-icon"><Ic.Key /></div>
            <div className="m-title">{t.loginTitle}</div>
            <div className="m-sub">{t.loginSubtitle}</div>
          </div>
          <form onSubmit={doLogin} className="m-form">
            <div className="f-field">
              <label className="f-lbl"><Ic.Mail /> {t.emailLabel}</label>
              <input className="f-inp" type="text" placeholder="your@email.com" value={un} onChange={e => setUn(e.target.value)} required />
            </div>
            <div className="f-field">
              <label className="f-lbl"><Ic.Lock /> {t.passwordLabel}</label>
              <div className="f-wrap">
                <input className="f-inp f-inp-pr" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} required />
                <button type="button" className="f-eye" onClick={() => setShowPw(s => !s)}><Ic.Eye off={showPw} /></button>
              </div>
            </div>
            {err && <div className="m-err">{err}</div>}
            <button className="m-btn-p" type="submit" disabled={loading}>
              {loading ? <><Ic.Spin /> {t.loggingIn}</> : <><Ic.Key /> {t.loginBtn}</>}
            </button>
          </form>
          <div className="m-div"><span>{t.orDivider}</span></div>
          <button className="m-btn-g" onClick={() => {
            const clientId = '311854255564-6a4pev18iqclmo2m3nj2akjkfov45d94.apps.googleusercontent.com';
            const redirect = encodeURIComponent('https://land-price-frontend.onrender.com/auth/callback');
            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
          }}>
            <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {t.googleBtn}
          </button>
          <div className="m-links">
            <button className="m-link" onClick={() => { setView('forgot'); setFpErr(''); }}>{t.forgotPassword}</button>
            <button className="m-link" onClick={onSwitchToRegister}>{t.noAccount}</button>
          </div>
        </>}

        {view === 'forgot' && <>
          <div className="m-head">
            <div className="m-icon"><Ic.Lock /></div>
            <div className="m-title">{t.forgotTitle}</div>
            <div className="m-sub">{t.forgotSub}</div>
          </div>
          <form onSubmit={doForgot} className="m-form">
            <div className="f-field">
              <label className="f-lbl"><Ic.Mail /> {t.emailLabel}</label>
              <input className="f-inp" type="text" placeholder="your@email.com" value={fpUser} onChange={e => setFpUser(e.target.value)} required />
            </div>
            {fpErr && <div className="m-err">{fpErr}</div>}
            <button className="m-btn-p" type="submit" disabled={fpLoad}>
              {fpLoad ? <><Ic.Spin /> {t.sendingReset}</> : <><Ic.Send /> {t.sendResetBtn}</>}
            </button>
          </form>
          <div className="m-links" style={{ justifyContent: 'center', marginTop: 10 }}>
            <button className="m-link" onClick={() => setView('login')}>{t.backToSignIn}</button>
          </div>
        </>}

        {view === 'sent' && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div className="m-ok-ring"><Ic.Check /></div>
            <div className="m-title" style={{ marginTop: 8 }}>{t.resetSentTitle}</div>
            <div className="m-sub" style={{ margin: '6px 0 14px' }}>{t.resetSentMsg}</div>
            <div className="m-spill">{fpUser}</div>
            <button className="m-btn-p" style={{ marginTop: 18 }} onClick={() => setView('login')}>
              <Ic.Key /> {t.backToSignIn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Password strength validator ─────────────────────────── */
function validatePassword(password, fullName, email, lang) {
  if (password.length < 8)
    return { ok: false, msg: lang === 'rw' ? 'Ijambo banga rigomba kuba nibura inyuguti 8.' : 'Password must be at least 8 characters.' };
  if (!/[A-Z]/.test(password))
    return { ok: false, msg: lang === 'rw' ? 'Ijambo banga rigomba kubamo nibura inyuguti nkuru imwe.' : 'Password must contain at least one uppercase letter.' };
  if (!/[a-z]/.test(password))
    return { ok: false, msg: lang === 'rw' ? 'Ijambo banga rigomba kubamo nibura inyuguti ntoya imwe.' : 'Password must contain at least one lowercase letter.' };
  if (!/[0-9]/.test(password))
    return { ok: false, msg: lang === 'rw' ? 'Ijambo banga rigomba kubamo nibura umubare umwe.' : 'Password must contain at least one number.' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password))
    return { ok: false, msg: lang === 'rw' ? 'Ijambo banga rigomba kubamo nibura ikimenyetso kidasanzwe (!@#$%^&* …).' : 'Password must contain at least one special character (!@#$%^&* …).' };
  if (fullName) {
    const nameParts = fullName.toLowerCase().split(/\s+/).filter(p => p.length >= 3);
    for (const part of nameParts)
      if (password.toLowerCase().includes(part))
        return { ok: false, msg: lang === 'rw' ? 'Ijambo banga ntirigomba kuba ririmo amazina yawe.' : 'Password must not contain your name.' };
  }
  if (email) {
    const emailUser = email.split('@')[0].toLowerCase();
    if (emailUser.length >= 3 && password.toLowerCase().includes(emailUser))
      return { ok: false, msg: lang === 'rw' ? 'Ijambo banga ntirigomba kuba ririmo imeri yawe.' : 'Password must not contain your email.' };
  }
  return { ok: true, msg: '' };
}

/* ── Email validator ─────────────────────────────────────── */
function validateEmail(email) {
  const lower = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lower)) return false;
  const allowedPatterns = [
    /^[^\s@]+@gmail\.com$/,
    /^[^\s@]+@yahoo\.[a-z.]{2,}$/,
    /^[^\s@]+@outlook\.com$/,
    /^[^\s@]+@hotmail\.com$/,
    /^[^\s@]+@icloud\.com$/,
    /^[^\s@]+@protonmail\.com$/,
    /^[^\s@]+@.*\.rw$/,
  ];
  return allowedPatterns.some(p => p.test(lower));
}

/* ── Phone validator ─────────────────────────────────────── */
// The UI now stores only the 10-digit suffix (after +25).
// Full number = "+25" + phoneSuffix, e.g. "+250780000000"
function validatePhone(phoneSuffix, lang) {
  const p = phoneSuffix.replace(/\D/g, '');
  const normalized = p.startsWith('0') ? p : '0' + p;
  if (!/^07[0-9]{8}$/.test(normalized)) return {
    ok: false,
    msg: lang === 'rw'
      ? 'Telefoni igomba kuba 7XXXXXXXX — MTN: 78/79, TIGO: 72/73.'
      : 'Phone must be 9 digits starting with 7 — MTN: 78/79, TIGO: 72/73.'
  };
  const prefix2 = normalized.slice(1, 3);
  const validPrefixes = ['72', '73', '78', '79'];
  if (!validPrefixes.includes(prefix2)) return {
    ok: false,
    msg: lang === 'rw'
      ? 'Nimero igomba gutangira na 72/73 (TIGO) cyangwa 78/79 (MTN).'
      : 'Phone prefix must be 72/73 (TIGO) or 78/79 (MTN).'
  };
  return { ok: true, msg: '' };
}

/* ── National ID validator ───────────────────────────────── */
function validateNationalId(nid, detectedSex, lang) {
  const id = nid.replace(/\s/g, '');
  if (id.length !== 16) return { ok: false, msg: lang === 'rw' ? 'Indangamuntu igomba kuba imibare 16.' : 'National ID must be exactly 16 digits.' };
  if (!/^\d{16}$/.test(id)) return { ok: false, msg: lang === 'rw' ? 'Indangamuntu igomba kuba imibare gusa.' : 'National ID must contain digits only.' };
  if (id[0] !== '1') return { ok: false, msg: lang === 'rw' ? 'Indangamuntu igomba gutangira na 1.' : 'National ID must start with 1.' };

  const yearStr = id.slice(1, 5);
  const year = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();
  if (year < 1900) return {
    ok: false,
    msg: lang === 'rw'
      ? `Nta muntu wavutse mu mwaka wa ${year} ukiriho uyu munsi.`
      : `No one born in ${year} would still be alive today.`
  };
  if (year > currentYear) return {
    ok: false,
    msg: lang === 'rw'
      ? `Umwaka wa ${year} ntabwo urabaho.`
      : `The year ${year} has not been reached yet.`
  };

  const sexCode = id.slice(5, 8);
  const sexNum = parseInt(sexCode, 10);
  const isMaleId = sexNum >= 800 && sexNum <= 899;
  const isFemaleId = sexNum >= 700 && sexNum <= 799;

  if (!isMaleId && !isFemaleId) return {
    ok: false,
    msg: lang === 'rw'
      ? `Umubare w'igitsina (${sexCode}) ugomba kuba 7XX (gore) cyangwa 8XX (gabo).`
      : `National ID sex code (${sexCode}) must be 7XX (female) or 8XX (male).`
  };
  if (detectedSex === 'male' && isFemaleId) return {
    ok: false,
    msg: lang === 'rw'
      ? 'Indangamuntu yerekana gore (7XX) ariko wahisemo Gabo.'
      : 'National ID indicates female (7XX) but you selected Male.'
  };
  if (detectedSex === 'female' && isMaleId) return {
    ok: false,
    msg: lang === 'rw'
      ? 'Indangamuntu yerekana gabo (8XX) ariko wahisemo Gore.'
      : 'National ID indicates male (8XX) but you selected Female.'
  };

  return { ok: true, msg: '', detectedSex: isMaleId ? 'male' : 'female' };
}

function SexSelector({ form, setForm, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const options = [
    { val: 'male',   labelEn: 'Male',   labelRw: 'Gabo', icon: '♂' },
    { val: 'female', labelEn: 'Female', labelRw: 'Gore', icon: '♀' },
  ];

  const selected = options.find(o => o.val === form.sex);
  const placeholder = lang === 'rw' ? 'Hitamo Igitsina' : 'Select your Sex';

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`f-inp${open ? ' f-inp-open' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', width: '100%', textAlign: 'left',
          color: selected ? 'var(--dark)' : '#6b7280',
          fontWeight: selected ? 600 : 400,
          background: open ? 'white' : 'var(--teal-l)',
          borderColor: open ? 'var(--teal)' : 'var(--g200)',
          boxShadow: open ? '0 0 0 3px rgba(13,148,136,.1)' : 'none',
        }}
      >
        <span>
          {selected
            ? `${selected.icon} ${lang === 'rw' ? selected.labelRw : selected.labelEn}`
            : placeholder}
        </span>
        <span style={{ color: 'var(--g600)', display: 'flex' }}>
          <Ic.Chev up={open} />
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'white', border: '1.5px solid var(--g200)',
          borderRadius: 'var(--rl)', boxShadow: 'var(--sh-md)', zIndex: 9999, overflow: 'hidden',
        }}>
          {options.map(o => (
            <button
              key={o.val}
              type="button"
              onClick={() => { setForm(f => ({ ...f, sex: o.val })); setOpen(false); }}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13, fontWeight: 600,
                color: 'var(--dark)',
                fontFamily: '"Times New Roman",Times,serif',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#99e6de'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <span>{o.icon} {lang === 'rw' ? o.labelRw : o.labelEn}</span>
              {form.sex === o.val && (
                <span style={{ color: 'var(--teal)', fontWeight: 800, fontSize: 15 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── REGISTER MODAL — 2-step, compact, with all validations ── */
function RegisterModal({ t, lang, onClose, onSwitchToLogin }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', national_id: '',
    password: '', confirm: '', role: 'buyer_seller', sex: ''
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [pwMatchErr, setPwMatchErr] = useState('');

  // ── Phone: store only the suffix digits the user types after "+25"
  // The full phone sent to the server will be "+25" + form.phone
  function handlePhoneInput(e) {
    // Strip any non-digit characters the user might paste
    const digits = e.target.value.replace(/\D/g, '');
    // Max 10 digits (e.g. 0780000000)
    setForm(f => ({ ...f, phone: digits.slice(0, 9) }));
  }

  function handleFullNameInput(e) {
    const val = e.target.value.replace(/[0-9]/g, '');
    setForm(f => ({ ...f, full_name: val }));
  }

  // ── National ID: numbers only
  function handleNidInput(e) {
    const digits = e.target.value.replace(/\D/g, '');
    const val = digits.slice(0, 16);
    setForm(f => {
      const next = { ...f, national_id: val };
      // Live sex detection
      if (val.length === 16) {
        const res = validateNationalId(val, f.sex, lang);
        if (res.ok && res.detectedSex) next.sex = res.detectedSex;
      }
      return next;
    });
  }

  const set = k => e => {
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    if (k === 'confirm') {
      setPwMatchErr(form.password !== val ? (lang === 'rw' ? 'Amagambo banga ntahuye.' : 'Passwords do not match.') : '');
    }
    if (k === 'password') {
      setPwMatchErr(form.confirm && form.confirm !== val ? (lang === 'rw' ? 'Amagambo banga ntahuye.' : 'Passwords do not match.') : '');
    }
  };

  function doNext(e) {
    e.preventDefault();
    setErr('');

    if (!form.full_name.trim()) {
      setErr(lang === 'rw' ? 'Amazina yuzuye asabwa.' : 'Full name is required.');
      return;
    }
    if (!form.email.trim()) {
      setErr(lang === 'rw' ? 'Imeri isabwa.' : 'Email is required.');
      return;
    }
    if (!validateEmail(form.email)) {
      setErr(lang === 'rw'
        ? 'Imeri igomba kurangira na @gmail.com, @yahoo.com, cyangwa imeri ya leta.'
        : 'Email must be a Gmail, Yahoo, or Government email (.rw / .ac.rw / .gov.rw etc.).'
      );
      return;
    }
    if (!form.phone.trim()) {
      setErr(lang === 'rw' ? 'Telefoni isabwa.' : 'Phone number is required.');
      return;
    }
    const phoneRes = validatePhone(form.phone, lang);
    if (!phoneRes.ok) { setErr(phoneRes.msg); return; }

    if (!form.national_id.trim()) {
      setErr(lang === 'rw' ? 'Indangamuntu isabwa.' : 'National ID is required.');
      return;
    }
    const nidRes = validateNationalId(form.national_id, form.sex, lang);
    if (!nidRes.ok) { setErr(nidRes.msg); return; }

    if (!form.sex) {
      setErr(lang === 'rw' ? 'Hitamo igitsina.' : 'Please select your sex.');
      return;
    }

    setStep(2);
  }

  async function doReg(e) {
    e.preventDefault();
    setErr('');

    if (form.password !== form.confirm) {
      setErr(lang === 'rw' ? 'Amagambo banga ntahuye.' : 'Passwords do not match.');
      return;
    }

    const pwRes = validatePassword(form.password, form.full_name, form.email, lang);
    if (!pwRes.ok) { setErr(pwRes.msg); return; }

    setLoading(true);
    try {
      // Send full international phone number to server
      const p = form.phone.replace(/\D/g, '');
      const fullPhone = '+250' + (p.startsWith('0') ? p.slice(1) : p);
      const d = await (await fetch('https://land-price-api-35fr.onrender.com/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          phone: fullPhone,
          national_id: form.national_id,
          sex: form.sex,
          role: form.role
        })
      })).json();
      setLoading(false);
      if (d.success) setSuccess(d.message);
      else setErr(d.message);
    } catch {
      setLoading(false);
      setErr('Cannot connect to server.');
    }
  }

  const phoneValid = validatePhone(form.phone, lang);

  return (
    <div className="m-overlay">
      <div className="m-box m-animate m-reg">
        <button className="m-close" onClick={onClose}><Ic.X /></button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div className="m-ok-ring"><Ic.Check /></div>
            <div className="m-title" style={{ marginTop: 8 }}>{lang === 'rw' ? 'Byagenze neza!' : 'Registration Successful!'}</div>
            <div className="m-sub" style={{ margin: '6px 0 16px' }}>{success}</div>
            <button className="m-btn-p" onClick={onSwitchToLogin}><Ic.Key /> {lang === 'rw' ? 'Injira' : 'Sign In'}</button>
          </div>
        ) : <>
          <div className="m-head" style={{ marginBottom: 14 }}>
            <div className="m-icon"><Ic.User /></div>
            <div className="m-title">{t.registerTitle}</div>
          </div>

          {/* Step pills */}
          <div className="reg-steps">
            <div className="reg-track"><div className="reg-fill" style={{ width: step === 2 ? '100%' : '0%' }} /></div>
            {[1, 2].map(s => (
            <div key={s} className={`reg-step ${step === s ? 'rs-active' : ''} ${step > s ? 'rs-done' : ''}`}>
              <div className="rs-dot">
                {step > s ? <Ic.Check /> :
                  (s === 2 && step === 2 &&
                  form.password &&
                  form.confirm &&
                  form.password === form.confirm &&
                  validatePassword(form.password, form.full_name, form.email, lang).ok
                ) ? <Ic.Check /> : s}
              </div>
              <div className="rs-name">{s === 1 ? t.step1Title : t.step2Title}</div>
            </div>
            ))}
          </div>

          {step === 1 && (
            <form onSubmit={doNext} className="m-form">
              <div className="reg-grid">

                {/* Full Name */}
                <div className="f-field">
                  <label className="f-lbl"><Ic.User /> {t.fullName} *</label>
                  <input className="f-inp"
                    placeholder={lang === 'rw' ? 'Amazina Yuzuye' : 'Enter your Full Name'}
                    value={form.full_name} onChange={handleFullNameInput} required />
                </div>

                {/* Sex */}
                <div className="f-field" style={{ position: 'relative' }}>
                  <label className="f-lbl">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
                    </svg>
                    {lang === 'rw' ? 'Igitsina' : 'Sex'} *
                  </label>
                  <SexSelector form={form} setForm={setForm} lang={lang} />
                </div>

                {/* ── Phone: fixed "+25" prefix + 10-digit suffix ── */}
                <div className="f-field">
                  <label className="f-lbl"><Ic.Phone /> {t.phone} *</label>
                  <div className="phone-wrap">
                    <span className="phone-prefix">+250</span>
                    <input
                      className="phone-suffix"
                      type="text"
                      inputMode="numeric"
                      placeholder="7XXXXXXXXX"
                      value={form.phone}
                      onChange={handlePhoneInput}
                      maxLength={10}
                      required
                    />
                  </div>
                  {form.phone && !phoneValid.ok && (
                    <span style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>
                      {phoneValid.msg}
                    </span>
                  )}
                  {form.phone && phoneValid.ok && (
                    <span style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                      ✓ {lang === 'rw' ? 'Nimero yemewe' : 'Valid phone number'} (+250{form.phone})
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="f-field">
                  <label className="f-lbl"><Ic.Mail /> {t.email} *</label>
                  <input className="f-inp" type="email"
                    placeholder="you@gmail.com / you@mininfra.gov.rw"
                    value={form.email} onChange={set('email')} required />
                  {form.email && !validateEmail(form.email) && (
                    <span style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>
                      {lang === 'rw'
                        ? 'Koresha Gmail, Yahoo, Outlook, Hotmail, cyangwa imeri ya leta'
                        : 'Use Gmail, Yahoo, Outlook, Hotmail, or any Government email'}
                    </span>
                  )}
                </div>

                {/* National ID — full width, numbers only */}
                <div className="f-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="f-lbl"><Ic.ID /> {t.nationalId} *</label>
                  <input
                    className="f-inp"
                    type="text"
                    inputMode="numeric"
                    placeholder={lang === 'rw' ? 'Urugero: 1199980000000000 (Gabo) / 1199970000000000 (Gore)' : 'e.g. 1199980000000000 (Male) / 1199970000000000 (Female)'}
                    value={form.national_id}
                    onChange={handleNidInput}
                    maxLength={16}
                    required
                  />
                  {/* Live ID feedback */}
                  {form.national_id.length > 0 && (
                    (() => {
                      const nid = form.national_id;
                      if (nid.length < 16) {
                        return <span style={{ fontSize: 11, color: 'var(--g600)', marginTop: 2 }}>{16 - nid.length} {lang === 'rw' ? 'imibare isigaye' : 'digits remaining'}</span>;
                      }
                      const res = validateNationalId(nid, form.sex, lang);
                      if (!res.ok) return <span style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>{res.msg}</span>;
                      return <span style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                        ✓ {lang === 'rw' ? `Nimero yemewe — ${res.detectedSex === 'male' ? 'Gabo' : 'Gore'}` : `Valid — ${res.detectedSex === 'male' ? 'Male' : 'Female'} detected`}
                      </span>;
                    })()
                  )}
                </div>

              </div>

              {err && <div className="m-err">{err}</div>}
              <button className="m-btn-p" type="submit"><Ic.Send /> {t.nextBtn} &rarr;</button>
              <div className="m-links" style={{ justifyContent: 'center' }}>
                <button className="m-link" type="button" onClick={onSwitchToLogin}>{t.alreadyAccount}</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={doReg} className="m-form">
              <div className="reg-grid">
                <div className="f-field">
                  <label className="f-lbl"><Ic.Lock /> {t.password} *</label>
                  <div className="f-wrap">
                    <input className="f-inp f-inp-pr"
                      type={showPw ? 'text' : 'password'}
                      placeholder={lang === 'rw' ? 'Nibura 8 (inyuguti+nimero)' : 'Min. 8 chars (letters+numbers)'}
                      value={form.password} onChange={set('password')} required />
                    <button type="button" className="f-eye" onClick={() => setShowPw(s => !s)}><Ic.Eye off={showPw} /></button>
                  </div>
                  {form.password && (() => {
                    const res = validatePassword(form.password, form.full_name, form.email, lang);
                    return !res.ok
                      ? <span style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>{res.msg}</span>
                      : <span style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>✓ {lang === 'rw' ? 'Ijambo banga rirakwiye' : 'Password looks good'}</span>;
                  })()}
                </div>

                <div className="f-field">
                  <label className="f-lbl"><Ic.Lock /> {t.confirmPassword} *</label>
                  <div className="f-wrap">
                    <input className="f-inp f-inp-pr"
                      type={showCf ? 'text' : 'password'}
                      placeholder={lang === 'rw' ? 'Ijambo Banga Nanone' : 'Repeat Same Password Again'}
                      value={form.confirm} onChange={set('confirm')} required />
                    <button type="button" className="f-eye" onClick={() => setShowCf(s => !s)}><Ic.Eye off={showCf} /></button>
                  </div>
                  {form.confirm && (
                    form.password !== form.confirm
                      ? <span style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>
                          {lang === 'rw' ? 'Amagambo banga ntahuye.' : 'Passwords do not match.'}
                        </span>
                      : <span style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                          ✓ {lang === 'rw' ? 'Birahuye' : 'Passwords match'}
                        </span>
                  )}
                </div>
              </div>

              {err && <div className="m-err">{err}</div>}
              <button
                className="m-btn-p" type="submit"
                disabled={loading || !!pwMatchErr || (form.confirm && form.password !== form.confirm)}
                style={{ width: '100%' }}
              >
                {loading ? <><Ic.Spin /> {t.creatingAccount}</> : <><Ic.User /> {t.createAccountBtn}</>}
              </button>
              <button type="button" className="m-btn-s" style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setStep(1); setErr(''); }}>
                &larr; {t.backBtn}
              </button>
            </form>
          )}
        </>}
      </div>
    </div>
  );
}

/* ── Chatbot ────────────────────────────────────────────── */
function Chatbot({ lang, t }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp]   = useState('');
  const [typ, setTyp]   = useState(false);
  const [rst, setRst]   = useState(false);
  const sid = useRef('s_' + Date.now());
  const endR = useRef(null);
  const addMsg = useCallback((text, isBot) => setMsgs(p => [...p, { text, isBot, id: Date.now() + Math.random() }]), []);
  useEffect(() => setMsgs([{ text: t.chatGreeting, isBot: true, id: 0 }]), [lang, t.chatGreeting]);
  useEffect(() => endR.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, typ]);
  async function send(m) {
    const text = (m || inp).trim(); if (!text) return;
    addMsg(text, false); setInp(''); setTyp(true);
    try { const d = await apiPost('/chat', { message: text, session_id: sid.current }); setTyp(false); addMsg(d.response || '…', true); }
    catch { setTyp(false); addMsg('Sorry, could not connect.', true); }
  }
  async function doReset() {
    setRst(false); try { await apiPost('/chat/reset', { session_id: sid.current }); } catch {}
    sid.current = 's_' + Date.now(); setMsgs([{ text: t.chatGreeting, isBot: true, id: Date.now() }]);
  }
  return (
    <>
      <button className={`ct-btn ${open ? 'ct-on' : ''}`} onClick={() => setOpen(o => !o)}>
        {open ? <Ic.X /> : <Ic.Chat />}
        {!open && <span className="ct-badge">AI</span>}
      </button>
      {open && (
        <div className="chatbot">
          <div className="cb-head">
            <div className="cb-av"><Ic.Chat /></div>
            <div><div className="cb-name">{t.chatTitle}</div><div className="cb-sub">{t.chatSub}</div></div>
            <button className="cb-rst" onClick={() => setRst(true)}>&#8635;</button>
          </div>
          {rst && (
            <div className="cb-modal-bg" onClick={() => setRst(false)}>
              <div className="cb-modal" onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.resetTitle}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 14 }}>{t.resetMsg}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-hover-light" onClick={() => setRst(false)}>{t.cancel}</button>
                  <button className="btn-hover-light" onClick={doReset}>{t.confirmReset}</button>
                </div>
              </div>
            </div>
          )}
          <div className="cb-msgs">
            {msgs.map(m => (
              <div key={m.id} className={`cb-msg ${m.isBot ? 'cb-bot' : 'cb-usr'}`}>
                <div className="cb-bbl" dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
              </div>
            ))}
            {typ && <div className="cb-msg cb-bot"><div className="cb-bbl cb-typ"><span/><span/><span/></div></div>}
            <div ref={endR} />
          </div>
          <div className="cb-inp">
            <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={t.chatPlaceholder} />
            <button onClick={() => send()}><Ic.Send /></button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── MAIN PAGE ──────────────────────────────────────────── */
export default function Home() {
  const [lang, setLang]             = useState('en');
  const [upi, setUpi]               = useState('');
  const [loading, setLoading]       = useState(false);
  const [predLoad, setPredLoad]     = useState(false);
  const [landData, setLandData]     = useState(null);
  const [preds, setPreds]           = useState(null);
  const [err, setErr]               = useState('');
  const [predErr, setPredErr]       = useState('');
  const [showL, setShowL]           = useState(false);
  const [showR, setShowR]           = useState(false);
  const router = useRouter();
  const resRef = useRef(null); const predRef = useRef(null);
  const t = T[lang];

  useEffect(() => {
    document.body.style.overflow = (showL || showR) ? 'hidden' : '';
    document.body.style.paddingRight = (showL || showR) ? `${window.innerWidth - document.documentElement.clientWidth}px` : '';
    return () => { document.body.style.overflow = ''; };
  }, [showL, showR]);

  useEffect(() => {
    localStorage.removeItem('lpe_user');
  }, []);

  async function doSearch() {
    const u = upi.trim(); if (!u) { setErr(t.enterUPI); return; }
    setErr(''); setLoading(true); setPreds(null); setLandData(null);
    try {
      const d = await apiPost('/search', { upi: u }); setLoading(false);
      if (d.success) { setLandData(d.data); setTimeout(() => resRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
      else setErr(d.message || t.notFound);
    } catch { setLoading(false); setErr(t.serverErr); }
  }

  async function doPredict() {
    if (!landData) { setPredErr(t.searchFirst); return; }
    setPredErr(''); setPredLoad(true); setPreds(null);
    try {
      const d = await apiPost('/predict', { upi: landData.UPI }); setPredLoad(false);
      if (d.success) { setPreds(d); setTimeout(() => predRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
      else setPredErr(d.message || t.predFailed);
    } catch { setPredLoad(false); setPredErr(t.serverErr); }
  }

  return (
    <>
      <Head>
        <title>Land Price Estimation System</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">

        {/* ── TOPBAR ── */}
        <header className="topbar">
          <div className="topbar-row">
            <LangSelector lang={lang} setLang={setLang} t={t} />
            <div className="tb-btn tb-static tb-grow">
              <span className="tb-icon-ring"><Ic.Grad /></span>
              <span className="tb-texts">
                <span className="tb-small">{t.polytechnic}</span>
                <span className="tb-main">{t.college}</span>
              </span>
            </div>
            <div className="tb-btn tb-static tb-grow">
              <span className="tb-icon-ring"><Ic.PC /></span>
              <span className="tb-texts">
                <span className="tb-small">{t.dept}</span>
                <span className="tb-main">{t.program}</span>
              </span>
            </div>
            <button className="tb-btn tb-login tb-grow" onClick={() => { setShowL(true); setShowR(false); }}>
              <span className="tb-icon-ring"><Ic.Key /></span>
              <span className="tb-texts">
                <span className="tb-small">{t.accountLabel}</span>
                <span className="tb-main">{t.loginLabel}</span>
              </span>
            </button>
          </div>
        </header>

        <div className="hero">
          <div className="hero-glow" />
          <h1><Ic.MapPin /> {t.title}</h1>
          <p className="hero-tag">{t.tagline}</p>
        </div>

        <main className="container">
          <div className="tax-notice">
            <span className="tn-icon"><Ic.Info /></span>
            <span>{t.taxNote}</span>
          </div>

          <div className="card">
            <div className="card-hd"><Ic.Search /> {t.searchTitle}</div>
            <div className="s-row">
              <input className="s-inp" value={upi} onChange={e => setUpi(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder={t.searchPlaceholder} />
              <button className="btn-p" onClick={doSearch} disabled={loading}>
                <Ic.Search /> {loading ? '...' : t.searchBtn}
              </button>
            </div>
            <div className="s-hint"><Ic.Info /> {t.searchHint}</div>
            {err && <div className="alert-e">{err}</div>}
          </div>

          {landData && (
            <div className="card" ref={resRef}>
              <div className="card-hd">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic.Tag /> {t.landData}</span>
                <span className="upi-bdg">UPI: {landData.UPI}</span>
              </div>
              <div className="d-grid">
                <div className="d-sec">
                  <div className="d-sec-title"><Ic.Info /> {t.basicInfo}</div>
                  <div className="d-cols">
                    <DataField label={t.province} value={landData.Province} />
                    <DataField label={t.district} value={landData.District} />
                    <DataField label={t.sector}   value={landData.Sector} />
                    <DataField label={t.cell}     value={landData.Cell} />
                  </div>
                  <DataField label={t.village} value={landData.Village} />
                </div>
                <div className="d-sec">
                  <div className="d-sec-title"><Ic.MapPin /> {t.location}</div>
                  <div className="d-cols">
                    <DataField label={t.xCoord} value={fmtNum(landData.X_coordinate, 4)} />
                    <DataField label={t.yCoord} value={fmtNum(landData.Y_coordinate, 4)} />
                  </div>
                  <DataField label={t.area} value={fmtNum(landData.Area, 2) + ' m²'} />
                </div>
                <div className="d-sec">
                  <div className="d-sec-title"><Ic.Tag /> {t.zoning}</div>
                  <div className="d-cols">
                    <DataField label={t.zoningLabel}   value={landData.Zoning} />
                    <DataField label={t.zoningPct}     value={fmtNum(landData['Zoning_%'], 2) + '%'} />
                    <DataField label={t.settlement}    value={landData.Settlement} />
                    <DataField label={t.settlementPct} value={fmtNum(landData['Settlement_%'], 2) + '%'} />
                  </div>
                  <DataField label={t.landUse} value={landData.Land_use} />
                </div>
                <div className="d-sec">
                  <div className="d-sec-title"><Ic.Chart /> {t.values}</div>
                  <DataField label={t.minSqm} value={fmtNum(landData.Min_Value_Sqm, 0) + ' RWF'} />
                  <DataField label={t.avgSqm} value={fmtNum(landData.Avg_Value_Sqm, 0) + ' RWF'} />
                  <DataField label={t.maxSqm} value={fmtNum(landData.Max_Value_Sqm, 0) + ' RWF'} />
                </div>
              </div>
              <button className="btn-pred" onClick={doPredict} disabled={predLoad}>
                <Ic.Brain /> {predLoad ? '...' : t.getPred}
              </button>
              {predErr && <div className="alert-e">{predErr}</div>}
            </div>
          )}

          {preds && (
            <div className="card" ref={predRef}>
              <div className="card-hd"><Ic.Brain /> {t.predTitle}</div>
              <div className="pred-info"><Ic.Info /> {t.predInfo}</div>
              <div className="p-grid">
                <PriceCard type="minimum" label={t.minEst} price={preds.min_price} perSqm={preds.min_per_sqm} taxNode={calcTax(preds.min_price, t)} t={t} />
                <PriceCard type="average" label={t.avgEst} price={preds.avg_price} perSqm={preds.avg_per_sqm} taxNode={calcTax(preds.avg_price, t)} t={t} />
                <PriceCard type="maximum" label={t.maxEst} price={preds.max_price} perSqm={preds.max_per_sqm} taxNode={calcTax(preds.max_price, t)} t={t} />
              </div>
              <div className="model-note"><Ic.Info /> {t.modelNote}</div>
            </div>
          )}
        </main>

        <footer className="footer">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Ic.Grad /></div>
          <strong>{t.footer}</strong>
          <p>{t.footerSub}</p>
          <p className="ft-tech">{t.footerTech}</p>
        </footer>

        {/* <Chatbot lang={lang} t={t} /> */}

        {showL && <LoginModal t={t} lang={lang} onClose={() => setShowL(false)}
          onLoginSuccess={url => { router.push(url); }}
          onSwitchToRegister={() => { setShowL(false); setShowR(true); }} />}
        {showR && <RegisterModal t={t} lang={lang} onClose={() => setShowR(false)}
          onSwitchToLogin={() => { setShowR(false); setShowL(true); }} />}
      </div>

      <style jsx global>{`
        :root{
          --teal:#0d9488;--teal-d:#0f766e;--teal-l:#f0fdfa;
          --cyan:#0891b2;--dark:#0c1a19;
          --g200:#ccf2ee;--g300:#99e6de;--g600:#4d7c77;
          --sh-sm:0 1px 3px rgba(13,148,136,.12);
          --sh-md:0 4px 12px rgba(13,148,136,.16);
          --sh-lg:0 10px 30px rgba(13,148,136,.20);
          --sh-xl:0 20px 50px rgba(13,148,136,.24);
          --r:12px;--rl:16px;--rxl:22px;
        }
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:"Times New Roman",Times,serif;background:#f0fdfa;min-height:100vh;color:var(--dark);line-height:1.6;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mIn{from{opacity:0;transform:scale(.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}

        .btn-hover-light{background:white;border:1.5px solid var(--g200);border-radius:12px;cursor:pointer;font-weight:600;font-family:"Times New Roman",serif;font-size:13px;color:var(--dark);transition:background .2s,border-color .2s,color .2s;padding:8px;flex:1;}
        .btn-hover-light:hover{background:var(--g300);border-color:var(--teal);color:var(--teal-d);}

        /* ── Phone input with fixed prefix ── */
        .phone-wrap{display:flex;align-items:stretch;border:1.5px solid var(--g200);border-radius:var(--rl);overflow:hidden;background:var(--teal-l);transition:border-color .22s,box-shadow .22s;}
        .phone-wrap:focus-within{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white;}
        .phone-prefix{display:flex;align-items:center;padding:0 10px 0 13px;font-size:13px;font-weight:700;color:var(--teal);background:transparent;white-space:nowrap;user-select:none;letter-spacing:.5px;}
        .phone-suffix{flex:1;padding:11px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:transparent;border:none;outline:none;color:var(--dark);min-width:0;}
        .phone-suffix::placeholder{color:#6b7280;}

        /* ── TOPBAR ── */
        .topbar{background:white;border-bottom:1px solid var(--g200);position:sticky;top:0;z-index:200;box-shadow:var(--sh-sm);width:100%;overflow:visible;}
        .topbar-row{width:100%;padding:10px 20px;display:flex;flex-direction:row;align-items:stretch;gap:10px;flex-wrap:nowrap;overflow-x:clip;overflow-y:visible;}
        .topbar-row::-webkit-scrollbar{height:3px;}
        .topbar-row::-webkit-scrollbar-thumb{background:var(--g200);}

        .tb-btn{display:flex;align-items:center;gap:9px;background:linear-gradient(135deg,#e0faf7,var(--teal-l));border:1.5px solid var(--teal);border-radius:var(--rl);padding:8px 14px;min-height:54px;transition:all .22s;flex-shrink:0;cursor:pointer;font-family:"Times New Roman",Times,serif;}
        .tb-btn:hover{background:linear-gradient(135deg,#ccf2ee,#e0faf7);transform:translateY(-1px);box-shadow:var(--sh-md);}
        .tb-static:hover{transform:none;box-shadow:none;}
        .tb-grow{flex:1 1 0;min-width:0;justify-content:center;}
        .tb-static{cursor:default;}
        .tb-clickable{cursor:pointer;}
        .tb-login{border-color:var(--teal);cursor:pointer;background:linear-gradient(135deg,#e0faf7,var(--teal-l));}
        .tb-login:hover{background:linear-gradient(135deg,#ccf2ee,#e0faf7);transform:translateY(-1px);box-shadow:var(--sh-md);}
        .tb-btn-open{border-color:var(--teal);box-shadow:var(--sh-md);}

        .tb-icon-ring{width:32px;height:32px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,var(--teal),var(--cyan));display:flex;align-items:center;justify-content:center;color:white;}
        .tb-texts{display:flex;flex-direction:column;gap:1px;}
        .tb-small{font-size:10px;color:var(--g600);font-weight:600;text-transform:uppercase;letter-spacing:.4px;line-height:1;white-space:nowrap;}
        .tb-main{font-size:12px;color:var(--teal);font-weight:700;line-height:1.3;white-space:nowrap;}
        .tb-chev{margin-left:3px;color:var(--g600);}

        .lang-drop{position:absolute;top:calc(100% + 6px);left:0;right:0;background:white;border:1.5px solid var(--g200);border-radius:var(--rl);box-shadow:var(--sh-md);z-index:9999;overflow:hidden;}
        .lang-opt{width:100%;padding:10px 14px;background:white;border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--dark);font-family:"Times New Roman",Times,serif;transition:background .15s;}
        .lang-opt:hover{background:#99e6de;}
        .lang-opt-on{background:white !important;color:var(--dark);}
        .lang-opt-on:hover{background:#99e6de !important;}

        /* Hero */
        .hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#0d9488,#0891b2,#0c4a6e);color:white;text-align:center;padding:44px 24px 36px;}
        .hero-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 60%,rgba(255,255,255,.07) 0%,transparent 60%);}
        .hero h1{font-family:"Times New Roman",Times,serif;font-size:clamp(20px,3.5vw,36px);font-weight:800;position:relative;z-index:1;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:12px;}
        .hero-tag{font-size:clamp(12px,1.5vw,15px);opacity:.85;position:relative;z-index:1;}

        .container{max-width:1200px;margin:0 auto;padding:28px 20px 60px;}

        .tax-notice{display:flex;align-items:center;gap:10px;background:#fefce8;border:1px solid #fde047;border-left:4px solid #f59e0b;border-radius:var(--r);padding:12px 16px;margin-bottom:20px;}
        .tn-icon{color:#f59e0b;flex-shrink:0;display:flex;}

        .card{background:white;border-radius:var(--rxl);box-shadow:var(--sh-md);border:1px solid var(--g200);overflow:hidden;margin-bottom:22px;animation:fadeUp .4s ease;}
        .card-hd{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:16px 22px;font-family:"Times New Roman",Times,serif;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .upi-bdg{background:rgba(255,255,255,.2);border-radius:50px;padding:3px 12px;font-size:12px;}

        .s-row{display:flex;gap:10px;padding:18px 20px 8px;}
        .s-inp{flex:1;padding:12px 16px;font-size:14px;font-family:"Times New Roman",Times,serif;border:1.5px solid var(--g200);border-radius:var(--rl);outline:none;transition:all .22s;background:white;}
        .s-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);}
        .s-hint{padding:3px 20px 14px;font-size:12px;color:var(--g600);display:flex;align-items:center;gap:5px;}
        .btn-p{display:flex;align-items:center;gap:7px;padding:12px 20px;font-size:14px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;white-space:nowrap;}
        .btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:var(--sh-md);}
        .btn-p:disabled{opacity:.7;cursor:not-allowed;}
        .alert-e{margin:0 20px 14px;background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:var(--r);padding:10px 14px;font-size:13px;}

        .d-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;padding:16px 20px;}
        .d-sec{background:var(--teal-l);border-radius:var(--rl);padding:14px;border:1px solid var(--g200);}
        .d-sec-title{font-size:13px;font-weight:700;color:var(--teal);margin-bottom:10px;display:flex;align-items:center;gap:6px;}
        .d-cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px;}
        .data-field{margin-bottom:5px;}
        .data-label{font-size:10px;color:var(--g600);font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
        .data-value{font-size:13px;color:var(--dark);font-weight:600;}

        .btn-pred{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px 20px 18px;width:calc(100% - 40px);padding:14px;font-size:15px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,#7c3aed,#0d9488);color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .3s;}
        .btn-pred:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(124,58,237,.3);}
        .btn-pred:disabled{opacity:.7;cursor:not-allowed;}
        .pred-info{margin:14px 20px 8px;padding:10px;background:var(--teal-l);border-radius:var(--r);font-size:13px;color:var(--g600);display:flex;align-items:center;gap:7px;}
        .p-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;padding:0 20px 18px;}
        .price-card{border-radius:var(--rl);padding:18px;text-align:center;border:2px solid var(--g200);}
        .price-card.minimum{background:#f0fdf4;border-color:#86efac;}
        .price-card.average{background:#eff6ff;border-color:#93c5fd;}
        .price-card.maximum{background:#fef3c7;border-color:#fcd34d;}
        .price-label{font-size:11px;font-weight:700;color:var(--g600);text-transform:uppercase;margin-bottom:6px;}
        .price-total{font-size:17px;font-weight:800;color:var(--dark);margin-bottom:4px;}
        .price-sqm{font-size:12px;color:var(--g600);margin-bottom:8px;}
        .price-tax{font-size:12px;}
        .no-tax{color:#16a34a;font-weight:600;}
        .model-note{padding:0 20px 18px;font-size:12px;color:var(--g600);display:flex;align-items:center;gap:6px;}

        .footer{background:linear-gradient(135deg,#0c1a19,#0d2e2b);color:white;text-align:center;padding:28px 20px;}
        .footer strong{font-family:"Times New Roman",Times,serif;font-size:16px;font-weight:700;}
        .footer p{font-size:12px;opacity:.9;margin-top:4px;}
        .ft-tech{font-size:11px;opacity:.7;font-style:italic;}

        /* Chatbot */
        .ct-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--sh-lg);z-index:1000;transition:all .3s;}
        .ct-on{background:linear-gradient(135deg,#64748b,#475569);}
        .ct-badge{position:absolute;top:-2px;right:-2px;background:#f59e0b;color:white;font-size:9px;font-weight:800;padding:2px 5px;border-radius:50px;font-family:sans-serif;}
        .chatbot{position:fixed;bottom:84px;right:24px;width:330px;background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);z-index:999;display:flex;flex-direction:column;max-height:470px;animation:fadeUp .3s ease;}
        .cb-head{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;padding:13px 15px;border-radius:var(--rxl) var(--rxl) 0 0;display:flex;align-items:center;gap:9px;}
        .cb-av{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;}
        .cb-name{font-weight:700;font-size:13px;}
        .cb-sub{font-size:11px;opacity:.85;}
        .cb-rst{margin-left:auto;background:rgba(255,255,255,.2);border:none;color:white;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;}
        .cb-msgs{flex:1;overflow-y:auto;padding:13px;display:flex;flex-direction:column;gap:7px;}
        .cb-msg{display:flex;}
        .cb-bot{justify-content:flex-start;}
        .cb-usr{justify-content:flex-end;}
        .cb-bbl{max-width:85%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.5;}
        .cb-bot .cb-bbl{background:var(--teal-l);color:var(--dark);border-radius:3px 14px 14px 14px;}
        .cb-usr .cb-bbl{background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border-radius:14px 3px 14px 14px;}
        .cb-typ{display:flex;gap:4px;align-items:center;padding:11px 15px;}
        .cb-typ span{width:6px;height:6px;border-radius:50%;background:var(--teal);animation:bounce .9s infinite;}
        .cb-typ span:nth-child(2){animation-delay:.2s;}
        .cb-typ span:nth-child(3){animation-delay:.4s;}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        .cb-inp{display:flex;gap:7px;padding:9px 11px;border-top:1px solid var(--g200);}
        .cb-inp input{flex:1;padding:8px 12px;font-size:13px;border:1.5px solid var(--g200);border-radius:50px;outline:none;font-family:"Times New Roman",Times,serif;}
        .cb-inp input:focus{border-color:var(--teal);}
        .cb-inp button{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .cb-modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;border-radius:var(--rxl);z-index:10;}
        .cb-modal{background:white;border-radius:var(--rl);padding:18px;width:240px;text-align:center;}

        /* ── MODALS ── */
        .m-overlay{position:fixed;inset:0;background:rgba(12,26,25,.35);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;}
        .m-box{background:white;border-radius:var(--rxl);box-shadow:var(--sh-xl);border:1px solid var(--g200);width:100%;max-width:420px;padding:26px 26px 22px;position:relative;}
        .m-animate{animation:mIn .3s cubic-bezier(.22,.68,0,1.5) both;}
        .m-reg{max-width:500px;}
        .m-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--g200);background:var(--teal-l);color:var(--teal);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .m-close:hover{background:var(--teal);color:white;}
        .m-head{text-align:center;margin-bottom:18px;}
        .m-icon{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--cyan));display:flex;align-items:center;justify-content:center;color:white;margin:0 auto 10px;}
        .m-ok-ring{width:48px;height:48px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;color:white;margin:0 auto;}
        .m-title{font-family:"Times New Roman",Times,serif;font-size:19px;font-weight:800;color:var(--dark);margin:0 0 3px;}
        .m-sub{font-size:13px;color:var(--g600);margin:0;}
        .m-form{display:flex;flex-direction:column;gap:11px;}
        .f-field{display:flex;flex-direction:column;gap:4px;}
        .f-lbl{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:var(--dark);letter-spacing:.4px;text-transform:uppercase;font-family:"Times New Roman",Times,serif;}
        .f-inp{padding:11px 13px;font-size:13px;font-family:"Times New Roman",Times,serif;background:var(--teal-l);border:1.5px solid var(--g200);border-radius:var(--rl);color:var(--dark);outline:none;transition:all .22s;width:100%;box-sizing:border-box;}
        .f-inp:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(13,148,136,.1);background:white;}
        .f-inp::placeholder{color:#6b7280;}
        .f-inp-pr{padding-right:40px;}
        .f-wrap{position:relative;}
        .f-eye{position:absolute;right:11px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--g600);display:flex;padding:3px;transition:color .2s;}
        .f-eye:hover{color:var(--teal);}
        .m-err{background:#fff1f2;color:#be123c;border:1px solid #fecdd3;border-radius:var(--r);padding:9px 13px;font-size:12px;font-weight:500;}
        .m-btn-p{padding:13px;font-size:14px;font-weight:700;font-family:"Times New Roman",Times,serif;background:linear-gradient(135deg,var(--teal),var(--cyan));color:white;border:none;border-radius:var(--rl);cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 4px 12px rgba(13,148,136,.22);width:100%;}
        .m-btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 20px rgba(13,148,136,.28);}
        .m-btn-p:disabled{opacity:.7;cursor:not-allowed;}
        .m-btn-s{padding:13px 16px;font-size:13px;font-weight:700;font-family:"Times New Roman",Times,serif;background:white;color:var(--teal);border:1.5px solid var(--g200);border-radius:var(--rl);cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:6px;}
        .m-btn-s:hover{border-color:var(--teal);}
        .m-btn-g{width:100%;padding:11px;font-size:13px;font-weight:600;font-family:"Times New Roman",Times,serif;background:white;color:var(--dark);border:1.5px solid var(--g200);border-radius:var(--rl);cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:9px;}
        .m-btn-g:hover{border-color:var(--teal);box-shadow:var(--sh-sm);}
        .m-div{display:flex;align-items:center;gap:9px;margin:10px 0;}
        .m-div::before,.m-div::after{content:'';flex:1;height:1px;background:var(--g200);}
        .m-div span{font-size:10px;font-weight:700;color:var(--g600);letter-spacing:.8px;}
        .m-links{display:flex;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:6px;}
        .m-link{background:none;border:none;cursor:pointer;font-size:12px;font-weight:600;color:var(--teal);font-family:"Times New Roman",Times,serif;text-decoration:underline;padding:0;transition:color .2s;}
        .m-link:hover{color:var(--teal-d);}
        .m-spill{display:inline-block;background:var(--teal-l);border:1px solid var(--g300);border-radius:50px;padding:4px 16px;font-size:12px;font-weight:700;color:var(--teal);font-family:monospace;margin:10px 0 4px;}

        /* Step pills */
        .reg-steps{position:relative;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding:0 10px;}
        .reg-track{position:absolute;top:16px;left:30%;right:30%;height:2px;background:var(--g200);z-index:0;}
        .reg-fill{height:100%;background:var(--teal);transition:width .4s ease;}
        .reg-step{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;z-index:1;}
        .rs-dot{width:32px;height:32px;border-radius:50%;border:2px solid var(--g200);background:white;color:var(--g300);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .3s;font-family:"Times New Roman",Times,serif;}
        .rs-active .rs-dot{background:linear-gradient(135deg,var(--teal),var(--cyan));border-color:var(--teal);color:white;box-shadow:0 3px 10px rgba(13,148,136,.28);}
        .rs-done .rs-dot{background:var(--teal);border-color:var(--teal);color:white;}
        .rs-name{font-size:11px;font-weight:700;color:var(--g600);font-family:"Times New Roman",Times,serif;text-align:center;}
        .rs-active .rs-name{color:var(--teal);}

        /* 2-col grid */
        .reg-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
        @media(max-width:460px){.reg-grid{grid-template-columns:1fr;}}

        @media(max-width:680px){
          .topbar-row{padding:8px 10px;gap:8px;}
          .tb-btn{padding:7px 10px;min-height:48px;}
          .tb-main{font-size:11px;}
          .tb-small{font-size:9px;}
          .tb-icon-ring{width:28px;height:28px;}
        }
      `}</style>
    </>
  );
}