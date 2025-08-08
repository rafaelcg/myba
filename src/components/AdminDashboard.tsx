import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { API_BASE_URL } from '../utils/backendService';
import { UserList } from './admin/UserList';
import { Analytics } from './admin/Analytics';
import { SystemHealth } from './admin/SystemHealth';

type AdminView = 'overview' | 'users' | 'analytics' | 'system' | 'webhooks';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDashboard({ isOpen, onClose }: AdminDashboardProps) {
  const { user } = useUser();
  const { isSignedIn, getToken } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // On open, verify admin access using Clerk token
    const verify = async () => {
      if (!isOpen) return;
      setChecking(true);
      setIsAuthenticated(false);
      setAuthError('');
      try {
        if (!isSignedIn) {
          setAuthError('Please sign in to access the admin dashboard.');
          return;
        }
        const token = await getToken();
        if (!token) {
          setAuthError('Unable to get auth token');
          return;
        }
        const response = await fetch(`${API_BASE_URL}/security/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          setIsAuthenticated(true);
          setAuthError('');
        } else if (response.status === 403) {
          setAuthError('You do not have admin access.');
        } else {
          setAuthError('Authentication failed');
        }
      } catch (err) {
        setAuthError('Authentication failed');
      } finally {
        setChecking(false);
      }
    };
    verify();
  }, [isOpen, isSignedIn, getToken]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        width: '95vw',
        height: '95vh',
        borderRadius: '12px',
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        
        {!isAuthenticated ? (
          // Access Gate Screen
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '40px'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>Admin Dashboard</h2>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              {checking ? 'Checking access…' : (authError || 'Verifying your access…')}
            </p>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #ccc',
                color: '#666',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          // Dashboard Content
          <>
            {/* Sidebar Navigation */}
            <div style={{
              width: '250px',
              background: '#2c3e50',
              color: 'white',
              padding: '20px 0',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '0 20px',
                marginBottom: '30px',
                borderBottom: '1px solid #34495e',
                paddingBottom: '20px'
              }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Admin Dashboard</h3>
                {user && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                )}
              </div>
              
              <nav style={{ flex: 1 }}>
                {[
                  { id: 'overview', label: '📊 Overview', icon: '📊' },
                  { id: 'users', label: '👥 Users', icon: '👥' },
                  { id: 'analytics', label: '📈 Analytics', icon: '📈' },
                  { id: 'system', label: '⚙️ System Health', icon: '⚙️' },
                  { id: 'webhooks', label: '🔗 Webhooks', icon: '🔗' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id as AdminView)}
                    style={{
                      width: '100%',
                      padding: '15px 20px',
                      background: currentView === item.id ? '#34495e' : 'transparent',
                      color: 'white',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background 0.2s ease',
                      borderLeft: currentView === item.id ? '3px solid #3498db' : '3px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (currentView !== item.id) {
                        e.currentTarget.style.background = '#34495e';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentView !== item.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              
              <div style={{ padding: '20px', borderTop: '1px solid #34495e' }}>
                <button
                  onClick={onClose}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Close Dashboard
                </button>
              </div>
            </div>
            
            {/* Main Content */}
            <div style={{
              flex: 1,
              background: '#f8f9fa',
              overflow: 'auto'
            }}>
              {currentView === 'overview' && (
                <div style={{ padding: '20px' }}>
                  <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>System Overview</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#3498db' }}>Quick Actions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button onClick={() => setCurrentView('users')} style={{ padding: '8px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>View Users</button>
                        <button onClick={() => setCurrentView('analytics')} style={{ padding: '8px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>View Analytics</button>
                        <button onClick={() => setCurrentView('system')} style={{ padding: '8px', background: '#f39c12', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>System Health</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {currentView === 'users' && <UserList />}
              {currentView === 'analytics' && <Analytics />}
              {currentView === 'system' && <SystemHealth />}
              {currentView === 'webhooks' && (
                <div style={{ padding: '20px' }}>
                  <h2 style={{ color: '#2c3e50' }}>Webhook Status</h2>
                  <p>Webhook monitoring interface will be displayed here.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}