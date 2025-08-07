import { useState, useEffect } from 'react';

interface User {
  userId: string;
  email?: string;
  name?: string;
  tokens: number;
  used: number;
  remaining: number;
  purchased: number;
  transferred: number;
  lastUpdated: string;
  created?: string;
  stripeCustomerId?: string;
}

interface UserListProps {
  apiKey: string;
}

export function UserList({ apiKey }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adjustTokens, setAdjustTokens] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const fetchUsers = async (page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const response = await fetch(
        `/myba/api/admin/users?page=${page}&limit=20&search=${encodeURIComponent(searchTerm)}`,
        { headers: { 'X-API-Key': apiKey } }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setCurrentPage(data.pagination.currentPage);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentPage, search);
  }, [apiKey, currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers(1, search);
  };

  const handleTokenAdjustment = async () => {
    if (!selectedUser || !adjustTokens || !adjustReason) return;

    try {
      const response = await fetch(`/myba/api/admin/users/${selectedUser.userId}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          tokens: parseInt(adjustTokens),
          reason: adjustReason
        })
      });

      if (response.ok) {
        // Refresh users list
        fetchUsers(currentPage, search);
        setSelectedUser(null);
        setAdjustTokens('');
        setAdjustReason('');
      }
    } catch (error) {
      console.error('Failed to adjust tokens:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>User Management</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 16px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading users...</div>
        </div>
      ) : (
        <>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr',
              gap: '1px',
              background: '#e0e0e0',
              fontWeight: 'bold',
              fontSize: '12px',
              textTransform: 'uppercase',
              color: '#666'
            }}>
              <div style={{ padding: '12px', background: 'white' }}>User</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Total</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Used</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Remaining</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Purchased</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Last Activity</div>
              <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>Actions</div>
            </div>

            {users.map((user) => (
              <div
                key={user.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr',
                  gap: '1px',
                  background: '#e0e0e0',
                  fontSize: '14px'
                }}
              >
                <div style={{ padding: '12px', background: 'white' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {user.email || `User ${user.userId.substring(0, 8)}...`}
                  </div>
                  {user.name && (
                    <div style={{ fontSize: '12px', color: '#666' }}>{user.name}</div>
                  )}
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                    ID: {user.userId.substring(0, 12)}...
                  </div>
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>
                  <span style={{ 
                    background: '#3498db', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {user.tokens}
                  </span>
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>
                  <span style={{ 
                    background: user.used > 0 ? '#e74c3c' : '#95a5a6', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {user.used}
                  </span>
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>
                  <span style={{ 
                    background: user.remaining > 0 ? '#2ecc71' : '#e74c3c', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {user.remaining}
                  </span>
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>
                  <span style={{ 
                    background: user.purchased > 0 ? '#f39c12' : '#95a5a6', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {user.purchased}
                  </span>
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center', fontSize: '11px', color: '#666' }}>
                  {formatDate(user.lastUpdated)}
                </div>
                
                <div style={{ padding: '12px', background: 'white', textAlign: 'center' }}>
                  <button
                    onClick={() => setSelectedUser(user)}
                    style={{
                      padding: '4px 8px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '20px',
              gap: '10px'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  background: currentPage === 1 ? '#ccc' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>
              
              <span style={{ padding: '8px 16px', background: '#ecf0f1', borderRadius: '4px' }}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  background: currentPage === totalPages ? '#ccc' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Token Adjustment Modal */}
      {selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Adjust Tokens</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <strong>User:</strong> {selectedUser.email || selectedUser.userId}
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <strong>Current Tokens:</strong> {selectedUser.tokens}
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                New Token Count:
              </label>
              <input
                type="number"
                min="0"
                max="10000"
                value={adjustTokens}
                onChange={(e) => setAdjustTokens(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Reason:
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: '8px 16px',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleTokenAdjustment}
                disabled={!adjustTokens || !adjustReason}
                style={{
                  padding: '8px 16px',
                  background: !adjustTokens || !adjustReason ? '#ccc' : '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !adjustTokens || !adjustReason ? 'not-allowed' : 'pointer'
                }}
              >
                Update Tokens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}