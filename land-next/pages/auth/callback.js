import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function GoogleCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Signing you in with Google…');

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) { setStatus('No auth code found. Redirecting…'); setTimeout(() => router.push('/'), 2000); return; }

    fetch('https://land-price-api-35fr.onrender.com/auth/google-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: 'https://land-price-frontend.onrender.com/auth/callback' }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          localStorage.setItem('lpe_user', JSON.stringify(d.user));
          router.push('/dashboard/buyer');
        } else {
          setStatus(d.message || 'Sign-in failed. Redirecting…');
          setTimeout(() => router.push('/'), 2500);
        }
      })
      .catch(() => { setStatus('Server error. Redirecting…'); setTimeout(() => router.push('/'), 2500); });
  }, []);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'"Times New Roman",serif', fontSize:16, color:'#0d9488' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, border:'4px solid #0d9488', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 16px' }} />
        {status}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}