import React, { useState, useEffect } from 'react';
import StatsCards from './StatsCards';
import EquityCurve from './EquityCurve';
import PerformanceBreakdown from './PerformanceBreakdown';
import TradeHistory from './TradeHistory';
import { getOverview, getEquityCurve } from '../services/api';

function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [equityCurve, setEquityCurve] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [overviewData, equityData] = await Promise.all([
        getOverview(),
        getEquityCurve(),
      ]);

      setOverview(overviewData);
      setEquityCurve(equityData);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  if (loading && !overview) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="dashboard">
        <div className="error">
          <h2>⚠️ Failed to Load Dashboard</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="last-update">
          {lastUpdate && (
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="btn-refresh"
          disabled={loading}
        >
          {loading ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning">
          ⚠️ {error}
        </div>
      )}

      <section className="section">
        <h2>Overview</h2>
        <StatsCards stats={overview} />
      </section>

      <section className="section">
        <h2>Equity Curve</h2>
        <EquityCurve data={equityCurve} />
      </section>

      <section className="section">
        <h2>Performance Breakdown</h2>
        <PerformanceBreakdown />
      </section>

      <section className="section">
        <h2>Trade History</h2>
        <TradeHistory />
      </section>
    </div>
  );
}

export default Dashboard;
