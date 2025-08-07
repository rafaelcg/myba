import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
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
  const [currentView, setCurrentView] = useState<AdminView>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Reset auth when modal opens
    if (isOpen) {
      setIsAuthenticated(false);
      setApiKey('');
      setAuthError('');
    }
  }, [isOpen]);

  const handleAuth = async () => {
    try {
      const response = await fetch('/myba/api/security/status', {
        headers: { 'X-API-Key': apiKey }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError('Invalid API key');
      }
    } catch (error) {
      setAuthError('Authentication failed');
    }
  };

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
          // Authentication Screen
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '40px'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>Admin Authentication</h2>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Enter the admin API key to access the dashboard
            </p>
            
            <div style={{ marginBottom: '20px', width: '100%', maxWidth: '400px' }}>
              <input
                type="password"
                placeholder="Admin API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  marginBottom: '10px'
                }}
              />
              
              {authError && (
                <div style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '10px' }}>
                  {authError}
                </div>
              )}
              
              <button
                onClick={handleAuth}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  marginBottom: '20px'
                }}
              >
                Authenticate
              </button>
            </div>
            
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
              
              {currentView === 'users' && <UserList apiKey={apiKey} />}
              {currentView === 'analytics' && <Analytics apiKey={apiKey} />}
              {currentView === 'system' && <SystemHealth apiKey={apiKey} />}
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