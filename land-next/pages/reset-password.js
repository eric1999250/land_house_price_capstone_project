import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

/* ── Translations ───────────────────────────────────────── */
const T = {
  en: {
    /* topbar */
    langLabel: 'Language', langName: 'English',
    polytechnic: 'RWANDA', college: 'SOUTHERN PROVINCE',
    dept: 'HUYE DISTRICT', program: 'HUYE & MBAZI SECTORS',
    accountLabel: 'MY ACCOUNT', accountSub: 'Reset Password',
    /* hero */
    heroTitle: 'Land Price Estimation System',
    heroTag: 'A Machine Learning - Powered Land Estimation and Tax Calculation System',
    /* card */
    cardHeader: 'Reset Password',
    badge: 'Password Reset',
    backBtn: 'Back to Sign In',
    newPwLabel: 'New Password',
    newPwPlaceholder: 'Min. 8 characters',
    confirmPwLabel: 'Confirm Password',
    confirmPwPlaceholder: 'Re-enter your password',
    pwMatch: 'Passwords match',
    pwNoMatch: 'Do not match',
    reqTitle: 'Requirements',
    req1: 'At least 8 characters',
    req2: 'One uppercase letter (A–Z)',
    req3: 'One lowercase letter (a–z)',
    req4: 'One number (0–9)',
    req5: 'One special character (!@#…)',
    req6: 'Must not contain your name or email',
    updateBtn: 'Update Password',
    updating: 'Updating…',
    /* strength */
    weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong', vstrong: 'Very Strong',
    /* errors */
    errNoMatch: 'Passwords do not match.',
    errShort: 'Password must be at least 8 characters.',
    errServer: 'Cannot connect to server. Make sure Flask is running on port 5000.',
    /* success */
    successTitle: 'Password Updated!',
    successDesc: 'Your password has been reset successfully. You can now sign in with your new password.',
    successBtn: 'Sign In Now',
    /* invalid */
    invalidTitle: 'Link Expired',
    invalidDesc: 'This reset link is invalid or has expired. Links are only valid for 30 minutes.',
    invalidBtn: 'Back to Sign In',
    /* footer */
    footer: 'Rwanda Polytechnic — Huye College',
    footerSub: 'ICT Department | Land Price Estimation System',
    taxNote: 'A Machine Learning-Based Framework for Land Price Estimation',
    footerTech: 'Powered by Machine Learning',
    errSamePass: 'New password must be different from your current password.',
  },
  rw: {
    langLabel: 'Ururimi', langName: 'Kinyarwanda',
    polytechnic: 'RWANDA', college: 'INTARA Y\'AMAJYEPFO',
    dept: 'AKARERE KA HUYE', program: 'IMIRENGE YA HUYE NA MBAZI',
    accountLabel: 'KONTE YANJYE', accountSub: 'Gusubiramo Ijambo Banga',
    heroTitle: 'Sisiteme yo Kugena Igiciro cy\'Ubutaka',
    heroTag: 'Sisiteme Ikoresha Machine Learning mu Kugena Igiciro cy\'Ubutaka no Kubara Umusoro',
    cardHeader: 'Subiramo Ijambo Banga',
    badge: 'Gusubiramo Ijambo Banga',
    backBtn: 'Garuka Kwinjira',
    newPwLabel: 'Ijambo Banga Rishya',
    newPwPlaceholder: 'Nibura inyuguti 8',
    confirmPwLabel: 'Emeza Ijambo Banga',
    confirmPwPlaceholder: 'Ijambo banga nanone',
    pwMatch: 'Amagambo banga arahuye',
    pwNoMatch: 'Amagambo Banga ntahuye',
    reqTitle: 'Ibisabwa',
    req1: 'Nibura inyuguti 8',
    req2: 'Inyuguti nkuru imwe (A–Z)',
    req3: 'Inyuguti ntoya imwe (a–z)',
    req4: 'Umubare umwe (0–9)',
    req5: 'Ikimenyetso kidasanzwe (!@#…)',
    req6: 'Ntirigomba kuba ririmo amazina cyangwa imeri yawe',
    updateBtn: 'Hindura Ijambo Banga',
    updating: 'Guhindurwa…',
    weak: 'Ntabwo ikomeye', fair: 'Iragerageza', good: 'Ni Nziza', strong: 'Ni Nziza Cyane', vstrong: 'Irahagije',
    errNoMatch: 'Amagambo banga ntahuye.',
    errShort: 'Ijambo banga rigomba kuba nibura inyuguti 8.',
    errServer: 'Byanze guhuza na seriveri.',
    successTitle: 'Ijambo Banga Ryahinduwe!',
    successDesc: 'Ijambo banga ryawe ryasubiwemo neza. Ubu ushobora kwinjira ukoresheje ijambo banga rishya.',
    successBtn: 'Injira Ubu',
    invalidTitle: 'Guhindura Ijambo Banga Byarangiye',
    invalidDesc: 'Guhindura Ijambo Banga Biranze. Bikora gusa mu minota 30.',
    invalidBtn: 'Garuka Kwinjira',
    footer: 'Kaminuza y\'Ikoranabuhanga — Ishuri Rikuru rya Huye',
    footerSub: 'Ishami ry\'Ikoranabuhanga | Sisiteme yo Kugena Igiciro cy\'Ubutaka',
    footerTech: 'Yifashishije Ikoranabuhanga rya Machine Learning',
    taxNote: 'Sisiteme Ikoresha Ikoranabuhanga rya Machine Learning mu Kugena Igiciro cy\'Ubutaka',
    errSamePass: 'Ijambo banga rishya rigomba gutandukana n\'irya kera.',
  }
};

/* ── SVG Icons (same as index) ──────────────────────────── */
const Ic = {
  Globe:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  Grad:   () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  PC:     () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Key:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>,
  MapPin: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Chev:   ({ up }) => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points={up ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>,
  Lock:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Eye:    ({ off }) => off
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  Check:  () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:      () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Warn:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Spin:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:'spin .7s linear infinite',display:'inline-block'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Arrow:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Info:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

/* ── Password validation (same rules as Register) ───────── */
function validatePassword(password, lang) {
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
  return { ok: true, msg: '' };
}

function getStrength(pw, lang) {
  let s = 0;
  if (pw.length >= 8)            s++;
  if (pw.length >= 12)           s++;
  if (/[A-Z]/.test(pw))          s++;
  if (/[0-9]/.test(pw))          s++;
  if (/[^A-Za-z0-9]/.test(pw))   s++;
  const t = lang === 'rw';
  if (s <= 1) return { label: t ? 'Ntabwo ikomeye' : 'Weak',        color: '#e05c6a', pct: 20  };
  if (s <= 2) return { label: t ? 'Iragerageza'    : 'Fair',        color: '#e8a838', pct: 45  };
  if (s <= 3) return { label: t ? 'Ni Nziza'       : 'Good',        color: '#5b9cf6', pct: 65  };
  if (s <= 4) return { label: t ? 'Ni Nziza Cyane' : 'Strong',      color: '#3ecf6e', pct: 85  };
  return             { label: t ? 'irahagije'      : 'Very Strong', color: '#3ecf6e', pct: 100 };
}    
/* ── Language Selector (identical to index) ─────────────── */
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
            <button key={l} className={`lang-opt ${lang === l ? 'lang-opt-on' : ''}`}
              onClick={() => { setLang(l); setOpen(false); }}>
              <span>{l === 'en' ? 'English' : 'Kinyarwanda'}</span>
              {lang === l && <span style={{ color: 'var(--teal)', fontWeight: 800, fontSize: 15 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function ResetPassword() {
  const router = useRouter();
  const [lang,        setLang]        = useState('en');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [view,        setView]        = useState('form');

  const t               = T[lang];
  const strength        = password ? getStrength(password, lang) : null;
  const passwordsMatch  = confirm && password === confirm;
  const passwordsMismatch = confirm && password !== confirm;

  const reqs = [
    { label: t.req1, met: password.length >= 8 },
    { label: t.req2, met: /[A-Z]/.test(password) },
    { label: t.req3, met: /[a-z]/.test(password) },
    { label: t.req4, met: /[0-9]/.test(password) },
    { label: t.req5, met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];

  const token = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('token') || ''
    : '';

  async function handleSubmit(e) {
  e.preventDefault();
  setError('');
  if (password !== confirm) { setError(t.errNoMatch); return; }
  const pwRes = validatePassword(password, lang);
  if (!pwRes.ok) { setError(pwRes.msg); return; }
  if (!token) { setView('invalid'); return; }
  setLoading(true);
  try {
    const res  = await fetch('http://127.0.0.1:5000/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setView('success');
    } else if (res.status === 400 && data.message && !data.message.includes('invalid') && !data.message.includes('expired')) {
      // Validation error (e.g. same password) — stay on form, show error
      setError(
        data.message.includes('different')
          ? t.errSamePass
          : data.message
      );
    } else {
      // Truly invalid/expired token
      setView('invalid');
    }

  } catch {
    setLoading(false);
    setError(t.errServer);
  }
}

  return (
    <>
      <Head>
        <title>Reset Password — Land Price Estimation System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="app">

        {/* ── TOPBAR — identical to index ── */}
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
            <div className="tb-btn tb-static tb-grow">
              <span className="tb-icon-ring"><Ic.Key /></span>
              <span className="tb-texts">
                <span className="tb-small">{t.accountLabel}</span>
                <span className="tb-main">{t.accountSub}</span>
              </span>
            </div>
          </div>
        </header>

        {/* ── HERO — identical to index ── */}
        <div className="hero">
          <div className="hero-glow" />
          <h1><Ic.MapPin /> {t.heroTitle}</h1>
          <p className="hero-tag">{t.heroTag}</p>
        </div>

        {/* ── TAX NOTICE — full width like index ── */}
        <div className="notice-wrap">
          <div className="tax-notice">
            <span className="tn-icon"><Ic.Info /></span>
            <span>{t.taxNote}</span>
          </div>
        </div>

        {/* ── MAIN ── */}
        <main className="container">
          <div className="card">
            <div className="card-hd">
              <Ic.Key /> {t.cardHeader}
            </div>
            <div className="form-body">

              {view === 'form' && (
                <div className="vw">
                  <button className="bk" onClick={() => router.push('/')}>
                    <Ic.Arrow /> {t.backBtn}
                  </button>

                  <form onSubmit={handleSubmit}>
                    {/* New Password */}
                    <div className="fd">
                      <label className="fl"><Ic.Lock /> {t.newPwLabel}</label>
                      <div className="iw">
                        <input className="fi" type={showPass ? 'text' : 'password'}
                          placeholder={t.newPwPlaceholder}
                          value={password} onChange={e => setPassword(e.target.value)}
                          required autoFocus />
                        <button type="button" className="ey-btn" onClick={() => setShowPass(s => !s)}>
                          <Ic.Eye off={showPass} />
                        </button>
                      </div>
                      {password && strength && (
                        <div className="str-wrap">
                          <div className="str-bg">
                            <div className="str-fill" style={{ width: `${strength.pct}%`, background: strength.color }} />
                          </div>
                          <span className="str-lbl" style={{ color: strength.color }}>{strength.label}</span>
                        </div>
                      )}
                      {/* Live password validation feedback */}
                      {password && (() => {
                        const res = validatePassword(password, lang);
                        return !res.ok
                          ? <span className="pw-hint pw-bad">{res.msg}</span>
                          : <span className="pw-hint pw-ok">
                              <Ic.Check /> {lang === 'rw' ? 'Ijambo banga rirakwiye' : 'Password looks good'}
                            </span>;
                      })()}
                    </div>

                    {/* Confirm Password */}
                    <div className="fd">
                      <label className="fl"><Ic.Lock /> {t.confirmPwLabel}</label>
                      <div className="iw">
                        <input
                          className={`fi ${passwordsMatch ? 'match' : ''} ${passwordsMismatch ? 'mismatch' : ''}`}
                          type={showConfirm ? 'text' : 'password'}
                          placeholder={t.confirmPwPlaceholder}
                          value={confirm} onChange={e => setConfirm(e.target.value)}
                          required />
                        <button type="button" className="ey-btn" onClick={() => setShowConfirm(s => !s)}>
                          <Ic.Eye off={showConfirm} />
                        </button>
                      </div>
                      {passwordsMatch    && <div className="mhint ok"><Ic.Check /> {t.pwMatch}</div>}
                      {passwordsMismatch && <div className="mhint bad"><Ic.X /> {t.pwNoMatch}</div>}
                    </div>

                    {/* Requirements checklist */}
                    <div className="reqs">
                      <div className="reqs-title">{t.reqTitle}</div>
                      {reqs.map((r, i) => (
                        <div key={i} className={`req ${r.met ? 'met' : ''}`}>
                          <span className="req-dot">{r.met ? <Ic.Check /> : ''}</span>
                          {r.label}
                        </div>
                      ))}
                    </div>

                    {error && (
                      <div className="alert-error">
                        <Ic.Warn /> <span>{error}</span>
                      </div>
                    )}

                    <button className="btn-primary" type="submit"
                      disabled={loading || (confirm && password !== confirm)}>
                      {loading
                        ? <><Ic.Spin /> {t.updating}</>
                        : <><Ic.Key /> {t.updateBtn}</>
                      }
                    </button>
                  </form>
                </div>
              )}

              {view === 'success' && (
                <div className="vw">
                  <div className="sbox">
                    <div className="sico"><Ic.Check /></div>
                    <div className="s-title">{t.successTitle}</div>
                    <p className="s-desc">{t.successDesc}</p>
                    <button className="btn-primary" onClick={() => router.push('/')}>
                      <Ic.Key /> {t.successBtn}
                    </button>
                  </div>
                </div>
              )}

              {view === 'invalid' && (
                <div className="vw">
                  <div className="sbox">
                    <div className="sico bad"><Ic.Warn /></div>
                    <div className="s-title">{t.invalidTitle}</div>
                    <p className="s-desc">{t.invalidDesc}</p>
                    <button className="btn-primary" onClick={() => router.push('/')}>
                      <Ic.Arrow /> {t.invalidBtn}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>

        {/* ── FOOTER — identical to index ── */}
        <footer className="footer">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Ic.Grad /></div>
          <strong>{t.footer}</strong>
          <p>{t.footerSub}</p>
          <p className="ft-tech">{t.footerTech}</p>
        </footer>

      </div>

      <style jsx global>{`
        :root {
          --teal:#0d9488; --teal-d:#0f766e; --teal-l:#f0fdfa;
          --cyan:#0891b2; --dark:#0c1a19;
          --g200:#ccf2ee; --g300:#99e6de; --g600:#4d7c77;
          --sh-sm:0 1px 3px rgba(13,148,136,.12);
          --sh-md:0 4px 12px rgba(13,148,136,.16);
          --sh-lg:0 10px 30px rgba(13,148,136,.20);
          --sh-xl:0 20px 50px rgba(13,148,136,.24);
          --r:12px; --rl:16px; --rxl:22px;
        }
        *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:"Times New Roman",Times,serif; background:#f0fdfa; min-height:100vh; color:var(--dark); line-height:1.6; }
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes vwin    { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pop     { from { opacity:0; transform:scale(.4) } to { opacity:1; transform:scale(1) } }
        @keyframes shk     { 0%,100% { transform:translateX(0) } 30% { transform:translateX(-4px) } 70% { transform:translateX(4px) } }

        /* ── TOPBAR — identical to index ── */
        .topbar { background:white; border-bottom:1px solid var(--g200); position:sticky; top:0; z-index:200; box-shadow:var(--sh-sm); width:100%; overflow:visible; }
        .topbar-row { width:100%; padding:10px 20px; display:flex; flex-direction:row; align-items:stretch; gap:10px; flex-wrap:nowrap; overflow-x:clip; overflow-y:visible; }

        .tb-btn { display:flex; align-items:center; gap:9px; background:linear-gradient(135deg,#e0faf7,var(--teal-l)); border:1.5px solid var(--teal); border-radius:var(--rl); padding:8px 14px; min-height:54px; transition:all .22s; flex-shrink:0; cursor:pointer; font-family:"Times New Roman",Times,serif; }
        .tb-btn:hover { background:linear-gradient(135deg,#ccf2ee,#e0faf7); transform:translateY(-1px); box-shadow:var(--sh-md); }
        .tb-static:hover { transform:none; box-shadow:none; }
        .tb-grow { flex:1 1 0; min-width:0; justify-content:center; }
        .tb-static { cursor:default; }
        .tb-clickable { cursor:pointer; }
        .tb-btn-open { border-color:var(--teal); box-shadow:var(--sh-md); }
        .tb-icon-ring { width:32px; height:32px; border-radius:50%; flex-shrink:0; background:linear-gradient(135deg,var(--teal),var(--cyan)); display:flex; align-items:center; justify-content:center; color:white; }
        .tb-texts { display:flex; flex-direction:column; gap:1px; }
        .tb-small { font-size:10px; color:var(--g600); font-weight:600; text-transform:uppercase; letter-spacing:.4px; line-height:1; white-space:nowrap; }
        .tb-main  { font-size:12px; color:var(--teal); font-weight:700; line-height:1.3; white-space:nowrap; }
        .tb-chev  { margin-left:3px; color:var(--g600); }

        .lang-drop { position:absolute; top:calc(100% + 6px); left:0; right:0; background:white; border:1.5px solid var(--g200); border-radius:var(--rl); box-shadow:var(--sh-md); z-index:9999; overflow:hidden; }
        .lang-opt { width:100%; padding:10px 14px; background:white; border:none; cursor:pointer; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:13px; font-weight:600; color:var(--dark); font-family:"Times New Roman",Times,serif; transition:background .15s; }
        .lang-opt:hover { background:#99e6de; }
        .lang-opt-on { background:white !important; }
        .lang-opt-on:hover { background:#99e6de !important; }

        /* ── HERO — identical to index ── */
        .hero { position:relative; overflow:hidden; background:linear-gradient(135deg,#0d9488,#0891b2,#0c4a6e); color:white; text-align:center; padding:44px 24px 36px; }
        .hero-glow { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 60%,rgba(255,255,255,.07) 0%,transparent 60%); }
        .hero h1 { font-family:"Times New Roman",Times,serif; font-size:clamp(20px,3.5vw,36px); font-weight:800; position:relative; z-index:1; margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:12px; }
        .hero-tag { font-size:clamp(12px,1.5vw,15px); opacity:.85; position:relative; z-index:1; }

        /* ── CONTAINER / CARD ── */
        .notice-wrap  { padding:28px 20px 0; max-width:1200px; margin:0 auto; }
        .container    { max-width:500px; margin:0 auto; padding:20px 20px 60px; }
        .tax-notice   { display:flex; align-items:center; gap:10px; background:#fefce8; border:1px solid #fde047; border-left:4px solid #f59e0b; border-radius:var(--r); padding:12px 16px; margin-bottom:0; }
        .tn-icon      { color:#f59e0b; flex-shrink:0; display:flex; }
        .card { background:white; border-radius:var(--rxl); box-shadow:var(--sh-xl); border:1px solid var(--g200); overflow:hidden; animation:fadeUp .4s ease; }
        .card-hd { background:linear-gradient(135deg,var(--teal),var(--cyan)); color:white; padding:16px 22px; font-family:"Times New Roman",Times,serif; font-size:16px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .form-body { padding:28px; background:white; }
        .vw { animation:vwin .35s ease both; }

        /* panel-badge */
        .panel-badge { display:inline-flex; align-items:center; gap:6px; background:var(--teal-l); border:1px solid var(--g300); border-radius:50px; padding:5px 14px; font-size:11px; font-weight:700; color:var(--teal); margin-bottom:14px; letter-spacing:.3px; text-transform:uppercase; }

        /* back button */
        .bk { display:inline-flex; align-items:center; gap:7px; background:none; border:none; cursor:pointer; font-size:13px; font-weight:600; color:var(--teal); font-family:"Times New Roman",Times,serif; margin-bottom:20px; transition:color .2s; padding:0; }
        .bk:hover { color:var(--teal-d); }

        /* fields */
        .fd { margin-bottom:20px; }
        .fl { display:flex; align-items:center; gap:5px; font-size:10px; font-weight:700; color:var(--dark); margin-bottom:8px; letter-spacing:.5px; text-transform:uppercase; font-family:"Times New Roman",Times,serif; }
        .iw { position:relative; }
        .fi { width:100%; padding:13px 44px 13px 16px; font-size:14px; font-family:"Times New Roman",Times,serif; background:var(--teal-l); border:1.5px solid var(--g200); border-radius:var(--rl); color:var(--dark); outline:none; transition:all .3s; }
        .fi::placeholder { color:#6b7280; }
        .fi:focus { border-color:var(--teal); box-shadow:0 0 0 3px rgba(13,148,136,.1); background:white; }
        .fi.match   { border-color:#16a34a; }
        .fi.mismatch{ border-color:#dc2626; }
        .ey-btn { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--g600); display:flex; padding:4px; transition:color .2s; }
        .ey-btn:hover { color:var(--teal); }

        /* strength bar */
        .str-wrap { margin-top:8px; }
        .str-bg   { height:4px; background:var(--g200); border-radius:4px; overflow:hidden; margin-bottom:4px; }
        .str-fill { height:100%; border-radius:4px; transition:width .3s,background .3s; }
        .str-lbl  { font-size:11px; font-weight:700; font-family:monospace; }

        /* live hints */
        .pw-hint    { font-size:11px; margin-top:6px; font-weight:600; display:flex; align-items:center; gap:5px; }
        .pw-ok      { color:#16a34a; }
        .pw-bad     { color:#be123c; }
        .mhint      { font-size:11px; margin-top:6px; font-weight:600; display:flex; align-items:center; gap:5px; }
        .mhint.ok   { color:#16a34a; }
        .mhint.bad  { color:#dc2626; }

        /* requirements */
        .reqs       { background:var(--teal-l); border:1px solid var(--g200); border-radius:var(--rl); padding:12px 16px; margin-bottom:16px; }
        .reqs-title { font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--g600); margin-bottom:10px; }
        .req        { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--g600); margin-bottom:6px; }
        .req:last-child { margin-bottom:0; }
        .req-dot    { width:16px; height:16px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--g200); transition:background .2s; color:transparent; font-size:9px; }
        .req.met    { color:var(--dark); }
        .req.met .req-dot { background:var(--teal); color:white; }

        /* alert */
        .alert-error { display:flex; align-items:center; gap:10px; background:#fff1f2; color:#be123c; border:1px solid #fecdd3; border-radius:var(--r); padding:12px 16px; font-size:13px; font-weight:500; margin-bottom:16px; animation:shk .3s ease; }

        /* primary button */
        .btn-primary { width:100%; padding:14px; font-size:15px; font-weight:700; font-family:"Times New Roman",Times,serif; background:linear-gradient(135deg,var(--teal),var(--cyan)); color:white; border:none; border-radius:var(--rl); cursor:pointer; transition:all .3s; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:var(--sh-md); margin-bottom:14px; }
        .btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:var(--sh-lg); }
        .btn-primary:disabled { opacity:.7; cursor:not-allowed; }

        /* success / invalid */
        .sbox    { text-align:center; padding:12px 0; }
        .sico    { display:inline-flex; align-items:center; justify-content:center; width:70px; height:70px; border-radius:50%; background:var(--teal-l); border:2px solid var(--g300); color:var(--teal); margin-bottom:18px; font-size:28px; animation:pop .5s cubic-bezier(.22,.68,0,1.5) both; }
        .sico.bad{ background:#fff1f2; border-color:#fecdd3; color:#be123c; }
        .s-title { font-size:22px; font-weight:800; color:var(--dark); margin-bottom:8px; font-family:"Times New Roman",Times,serif; }
        .s-desc  { font-size:13px; color:var(--g600); line-height:1.7; margin-bottom:20px; }

        /* ── FOOTER — identical to index ── */
        .footer      { background:linear-gradient(135deg,#0c1a19,#0d2e2b); color:white; text-align:center; padding:28px 20px; }
        .footer strong { font-family:"Times New Roman",Times,serif; font-size:16px; font-weight:700; }
        .footer p    { font-size:12px; opacity:.9; margin-top:4px; }
        .ft-tech     { font-size:11px; opacity:.7; font-style:italic; }

        @media(max-width:680px) {
          .topbar-row  { padding:8px 10px; gap:8px; }
          .tb-btn      { padding:7px 10px; min-height:48px; }
          .tb-main     { font-size:11px; }
          .tb-small    { font-size:9px; }
          .tb-icon-ring{ width:28px; height:28px; }
        }
      `}</style>
    </>
  );
}