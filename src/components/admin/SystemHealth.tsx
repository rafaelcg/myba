import { useState, useEffect } from 'react';

interface SystemHealthData {
  timestamp: string;
  system: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    nodeVersion: string;
    cpuUsage?: number;
    loadAverage?: number[];
  };
  security: {
    suspiciousClients: number;
    rateLimitViolations: number;
    totalRequests: number;
    blockedRequests: number;
  };
  anonymous: {
    totalSessions: number;
    activeSessions: number;
    conversionRate: string;
  };
  database: {
    connectionStatus: string;
    responseTime?: number;
  };
  services: {
    stripe: string;
    clerk: string;
    ai: string;
  };
}

interface SystemHealthProps {
  apiKey: string;
}

export function SystemHealth({ apiKey }: SystemHealthProps) {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/myba/api/security/status', {
        headers: { 'X-API-Key': apiKey }
      });

      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, [apiKey]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [apiKey, autoRefresh]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb.toFixed(1) + ' MB';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'connected':
      case 'active':
        return '#2ecc71';
      case 'warning':
      case 'degraded':
        return '#f39c12';
      case 'error':
      case 'down':
      case 'disconnected':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  if (loading && !healthData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading system health...</div>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Failed to load system health data</div>
        <button 
          onClick={fetchHealthData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const memoryUsage = healthData.system.memoryUsage;
  const memoryUtilization = (memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(1);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>System Health</h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          
          <button
            onClick={fetchHealthData}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? '#ccc' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {lastUpdated && (
        <div style={{ 
          marginBottom: '20px', 
          fontSize: '12px', 
          color: '#666',
          textAlign: 'right'
        }}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* System Status Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        {/* System Overview */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>
            System Overview
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Uptime:</strong> {formatUptime(healthData.system.uptime)}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Node.js:</strong> {healthData.system.nodeVersion}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Memory Usage:</strong> {formatBytes(memoryUsage.heapUsed)} / {formatBytes(memoryUsage.heapTotal)}
              <span style={{ color: '#666', marginLeft: '5px' }}>({memoryUtilization}%)</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Total Memory:</strong> {formatBytes(memoryUsage.rss)}
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>
            Security Status
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Total Requests:</strong> {healthData.security.totalRequests.toLocaleString()}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Blocked Requests:</strong> 
              <span style={{ 
                color: healthData.security.blockedRequests > 0 ? '#e74c3c' : '#2ecc71',
                marginLeft: '5px'
              }}>
                {healthData.security.blockedRequests}
              </span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Rate Limit Violations:</strong>
              <span style={{ 
                color: healthData.security.rateLimitViolations > 0 ? '#f39c12' : '#2ecc71',
                marginLeft: '5px'
              }}>
                {healthData.security.rateLimitViolations}
              </span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Suspicious Clients:</strong>
              <span style={{ 
                color: healthData.security.suspiciousClients > 0 ? '#e74c3c' : '#2ecc71',
                marginLeft: '5px'
              }}>
                {healthData.security.suspiciousClients}
              </span>
            </div>
          </div>
        </div>

        {/* Anonymous Sessions */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>
            Anonymous Sessions
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Total Sessions:</strong> {healthData.anonymous.totalSessions}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Active Sessions:</strong> {healthData.anonymous.activeSessions}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Conversion Rate:</strong>
              <span style={{ 
                color: parseFloat(healthData.anonymous.conversionRate) > 10 ? '#2ecc71' : '#f39c12',
                marginLeft: '5px'
              }}>
                {healthData.anonymous.conversionRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Service Status */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>
            Service Status
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Database:</strong>
              <span style={{
                color: getStatusColor(healthData.database.connectionStatus),
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px'
              }}>
                {healthData.database.connectionStatus}
              </span>
            </div>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Stripe:</strong>
              <span style={{
                color: getStatusColor(healthData.services.stripe),
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px'
              }}>
                {healthData.services.stripe}
              </span>
            </div>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Clerk:</strong>
              <span style={{
                color: getStatusColor(healthData.services.clerk),
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px'
              }}>
                {healthData.services.clerk}
              </span>
            </div>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>AI Service:</strong>
              <span style={{
                color: getStatusColor(healthData.services.ai),
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px'
              }}>
                {healthData.services.ai}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Usage Details */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50', fontSize: '16px' }}>
          Memory Usage Details
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Heap Used</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>
              {formatBytes(memoryUsage.heapUsed)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Heap Total</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2ecc71' }}>
              {formatBytes(memoryUsage.heapTotal)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>External</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f39c12' }}>
              {formatBytes(memoryUsage.external)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Array Buffers</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9b59b6' }}>
              {formatBytes(memoryUsage.arrayBuffers)}
            </div>
          </div>
        </div>

        {/* Memory Usage Bar */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
            Heap Utilization: {memoryUtilization}%
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#ecf0f1',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${memoryUtilization}%`,
              height: '100%',
              background: parseFloat(memoryUtilization) > 80 ? '#e74c3c' : 
                         parseFloat(memoryUtilization) > 60 ? '#f39c12' : '#2ecc71',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}