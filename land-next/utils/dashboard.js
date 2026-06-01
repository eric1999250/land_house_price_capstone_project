import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export function useDashboard(requiredRole) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('lpe_user');
    if (!stored) {
      router.replace('/login');
      return;
    }
    try {
      const u = JSON.parse(stored);
      if (requiredRole && u.role !== requiredRole) {
        const routes = {
          admin: '/dashboard/admin',
          district_land_officer: '/dashboard/district',
          sector_land_officer: '/dashboard/sector',
          notary: '/dashboard/notary',
          buyer_seller: '/dashboard/buyer',
        };
        router.replace(routes[u.role] || '/login');
        return;
      }
      setUser(u);
    } catch (e) {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }, [requiredRole, router]);

  function logout() {
    localStorage.removeItem('lpe_user');
    router.push('/login');
  }

  return { user, logout, loading };
}

export function DashShell({ user, logout, accent, icon, children }) {
  // children[0] = sidebar nav items
  // children[1] = topbar title
  // children[2] = main content
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f1f5f9;
          color: #1e293b;
        }
        .dashboard-container {
          display: flex;
          min-height: 100vh;
        }
        /* SIDEBAR - Left Panel */
        .sidebar {
          width: 280px;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          overflow-y: auto;
          transition: transform 0.3s ease;
          z-index: 100;
        }
        .sidebar-header {
          padding: 24px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .sidebar-logo {
          font-size: 24px;
          font-weight: 800;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sidebar-logo span:first-child {
          font-size: 28px;
        }
        .sidebar-logo span:last-child {
          font-size: 14px;
          font-weight: 500;
          color: #94a3b8;
        }
        .user-section {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.03);
        }
        .user-avatar {
          width: 48px;
          height: 48px;
          background: ${accent || '#3b82f6'};
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-bottom: 12px;
        }
        .user-name {
          font-weight: 700;
          color: white;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .user-role {
          font-size: 11px;
          color: #94a3b8;
        }
        .nav-menu {
          padding: 16px 0;
        }
        .nav-section {
          padding: 8px 20px 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 20px;
          margin: 2px 12px;
          border-radius: 10px;
          color: #cbd5e1;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .nav-item:hover {
          background: rgba(255,255,255,0.08);
          color: white;
        }
        .nav-item.active {
          background: ${accent || '#3b82f6'};
          color: white;
        }
        .nav-icon {
          font-size: 18px;
          width: 24px;
        }
        .logout-btn {
          margin: 20px 12px;
          padding: 10px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          color: #f87171;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          width: calc(100% - 24px);
          transition: all 0.2s;
        }
        .logout-btn:hover {
          background: rgba(239,68,68,0.25);
        }
        /* MAIN CONTENT - Right Panel */
        .main-content {
          flex: 1;
          margin-left: 280px;
          min-height: 100vh;
        }
        .top-bar {
          background: white;
          padding: 16px 32px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
        .role-badge {
          padding: 6px 14px;
          background: ${accent ? accent + '15' : '#eff6ff'};
          color: ${accent || '#2563eb'};
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .content-panel {
          padding: 32px;
        }
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .main-content {
            margin-left: 0;
          }
        }
      `}</style>

      <div className="dashboard-container">
        {/* LEFT PANEL - SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <span>🗺️</span>
              <span>Land Price<br/>Estimation</span>
            </div>
          </div>

          {user && (
            <div className="user-section">
              <div className="user-avatar">{icon || '👤'}</div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">
                {user.role === 'admin' ? 'System Administrator' :
                 user.role === 'district_land_officer' ? 'District Land Officer' :
                 user.role === 'sector_land_officer' ? 'Sector Land Officer' :
                 user.role === 'notary' ? 'Notary' : 'Buyer / Seller'}
              </div>
            </div>
          )}

          <div className="nav-menu">
            {children[0]}
          </div>

          <button className="logout-btn" onClick={logout}>
            🚪 Sign Out
          </button>
        </aside>

        {/* RIGHT PANEL - MAIN CONTENT */}
        <div className="main-content">
          <div className="top-bar">
            <div className="page-title">{children[1]}</div>
            <div className="role-badge">
              {user?.role === 'admin' ? 'Admin' :
               user?.role === 'district_land_officer' ? 'District Officer' :
               user?.role === 'sector_land_officer' ? 'Sector Officer' :
               user?.role === 'notary' ? 'Notary' : 'Buyer/Seller'}
            </div>
          </div>
          <div className="content-panel">
            {children[2]}
          </div>
        </div>
      </div>
    </>
  );
}