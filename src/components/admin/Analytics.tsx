import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MetricsData {
  timeframe: string;
  timestamp: string;
  users: {
    total: number;
    newInPeriod: number;
  };
  tokens: {
    totalIssued: number;
    totalUsed: number;
    totalPurchased: number;
    totalTransferred: number;
    utilization: string;
  };
  revenue: {
    total: number;
    recent: number;
    averagePerUser: string;
  };
  anonymous: {
    totalSessions: number;
    activeSessions: number;
    conversionRate: string;
  };
  security: {
    suspiciousClients: number;
    rateLimitViolations: number;
  };
  system: {
    uptime: number;
    memoryUsage: any;
    nodeVersion: string;
  };
}

interface AnalyticsProps {
  apiKey: string;
}

export function Analytics({ apiKey }: AnalyticsProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');

  const fetchMetrics = async (selectedTimeframe = timeframe) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/myba/api/admin/metrics?timeframe=${selectedTimeframe}`,
        { headers: { 'X-API-Key': apiKey } }
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [apiKey]);

  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe);
    fetchMetrics(newTimeframe);
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    return Math.round(bytes / 1024 / 1024) + ' MB';
  };

  if (loading && !metrics) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading analytics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Failed to load analytics data</div>
      </div>
    );
  }

  // Chart data
  const tokenDistributionData = {
    labels: ['Used Tokens', 'Remaining Tokens'],
    datasets: [{
      data: [metrics.tokens.totalUsed, metrics.tokens.totalIssued - metrics.tokens.totalUsed],
      backgroundColor: ['#e74c3c', '#2ecc71'],
      borderWidth: 0
    }]
  };

  const tokenSourceData = {
    labels: ['Welcome', 'Purchased', 'Transferred'],
    datasets: [{
      data: [
        metrics.tokens.totalIssued - metrics.tokens.totalPurchased - metrics.tokens.totalTransferred,
        metrics.tokens.totalPurchased,
        metrics.tokens.totalTransferred
      ],
      backgroundColor: ['#3498db', '#f39c12', '#9b59b6'],
      borderWidth: 0
    }]
  };

  const revenueData = {
    labels: ['Recent Revenue', 'Historical Revenue'],
    datasets: [{
      label: 'Revenue ($)',
      data: [metrics.revenue.recent, metrics.revenue.total - metrics.revenue.recent],
      backgroundColor: ['#27ae60', '#2ecc71'],
      borderWidth: 1,
      borderColor: ['#229954', '#28b463']
    }]
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Analytics Dashboard</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {['1d', '7d', '30d'].map((period) => (
            <button
              key={period}
              onClick={() => handleTimeframeChange(period)}
              style={{
                padding: '8px 16px',
                background: timeframe === period ? '#3498db' : '#ecf0f1',
                color: timeframe === period ? 'white' : '#2c3e50',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {period.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3498db', marginBottom: '5px' }}>
            {metrics.users.total}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Users</div>
          <div style={{ fontSize: '10px', color: '#95a5a6' }}>
            +{metrics.users.newInPeriod} in {timeframe}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2ecc71', marginBottom: '5px' }}>
            ${metrics.revenue.total.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Revenue</div>
          <div style={{ fontSize: '10px', color: '#95a5a6' }}>
            ${metrics.revenue.recent.toFixed(2)} in {timeframe}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f39c12', marginBottom: '5px' }}>
            {metrics.tokens.utilization}%
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Token Utilization</div>
          <div style={{ fontSize: '10px', color: '#95a5a6' }}>
            {metrics.tokens.totalUsed}/{metrics.tokens.totalIssued} tokens
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9b59b6', marginBottom: '5px' }}>
            {metrics.anonymous.conversionRate}%
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Conversion Rate</div>
          <div style={{ fontSize: '10px', color: '#95a5a6' }}>
            Anonymous → Authenticated
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '16px' }}>
            Token Usage
          </h3>
          <div style={{ height: '300px' }}>
            <Pie 
              data={tokenDistributionData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom' as const
                  }
                }
              }}
            />
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '16px' }}>
            Token Sources
          </h3>
          <div style={{ height: '300px' }}>
            <Pie 
              data={tokenSourceData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom' as const
                  }
                }
              }}
            />
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '16px' }}>
            Revenue Breakdown
          </h3>
          <div style={{ height: '300px' }}>
            <Bar 
              data={revenueData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return '$' + value;
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '16px' }}>
            System Status
          </h3>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>Uptime:</strong> {formatUptime(metrics.system.uptime)}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Memory:</strong> {formatBytes(metrics.system.memoryUsage.heapUsed)} / {formatBytes(metrics.system.memoryUsage.heapTotal)}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Node.js:</strong> {metrics.system.nodeVersion}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Active Anonymous Sessions:</strong> {metrics.anonymous.activeSessions}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Security Violations:</strong> {metrics.security.rateLimitViolations}
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '16px' }}>
          Detailed Metrics
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#3498db', fontSize: '14px' }}>User Metrics</h4>
            <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#666' }}>
              <div>Total Users: <strong>{metrics.users.total}</strong></div>
              <div>New Users ({timeframe}): <strong>{metrics.users.newInPeriod}</strong></div>
              <div>Average Revenue per User: <strong>${metrics.revenue.averagePerUser}</strong></div>
            </div>
          </div>
          
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#2ecc71', fontSize: '14px' }}>Token Metrics</h4>
            <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#666' }}>
              <div>Total Issued: <strong>{metrics.tokens.totalIssued}</strong></div>
              <div>Total Used: <strong>{metrics.tokens.totalUsed}</strong></div>
              <div>Total Purchased: <strong>{metrics.tokens.totalPurchased}</strong></div>
              <div>Total Transferred: <strong>{metrics.tokens.totalTransferred}</strong></div>
            </div>
          </div>
          
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#f39c12', fontSize: '14px' }}>Revenue Metrics</h4>
            <div style={{ fontSize: '12px', lineHeight: '1.8', color: '#666' }}>
              <div>Total Revenue: <strong>${metrics.revenue.total.toFixed(2)}</strong></div>
              <div>Recent Revenue ({timeframe}): <strong>${metrics.revenue.recent.toFixed(2)}</strong></div>
              <div>Average per User: <strong>${metrics.revenue.averagePerUser}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}