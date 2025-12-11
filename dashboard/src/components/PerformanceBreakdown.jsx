import React, { useState, useEffect } from 'react';
import { getBySymbol, getByTimeframe, getByMode } from '../services/api';

function PerformanceBreakdown() {
  const [activeTab, setActiveTab] = useState('symbol');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let result;
      switch (activeTab) {
        case 'symbol':
          result = await getBySymbol();
          break;
        case 'timeframe':
          result = await getByTimeframe();
          break;
        case 'mode':
          result = await getByMode();
          break;
        default:
          result = [];
      }
      setData(result);
    } catch (error) {
      console.error('Failed to fetch breakdown data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryKey = () => {
    return activeTab;
  };

  const getCategoryLabel = () => {
    return activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
  };

  return (
    <div className="performance-breakdown">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'symbol' ? 'active' : ''}`}
          onClick={() => setActiveTab('symbol')}
        >
          By Symbol
        </button>
        <button
          className={`tab ${activeTab === 'timeframe' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeframe')}
        >
          By Timeframe
        </button>
        <button
          className={`tab ${activeTab === 'mode' ? 'active' : ''}`}
          onClick={() => setActiveTab('mode')}
        >
          By Mode
        </button>
      </div>

      {loading ? (
        <div className="loading-small">
          <div className="spinner-small"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="no-data">
          <p>No data available for this breakdown</p>
        </div>
      ) : (
        <div className="breakdown-table-container">
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>{getCategoryLabel()}</th>
                <th>Trades</th>
                <th>Wins</th>
                <th>Losses</th>
                <th>Win Rate</th>
                <th>Avg R</th>
                <th>Profit Factor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => {
                const categoryValue = row[getCategoryKey()];
                const winrate = row.winrate * 100;
                const avgR = row.avgR;
                const profitFactor = row.profitFactor >= 999 ? '∞' : row.profitFactor.toFixed(2);

                return (
                  <tr key={index}>
                    <td className="category-cell">
                      <strong>{categoryValue}</strong>
                    </td>
                    <td>{row.trades}</td>
                    <td className="text-success">{row.wins}</td>
                    <td className="text-danger">{row.losses}</td>
                    <td className={winrate >= 50 ? 'text-success' : 'text-danger'}>
                      {winrate.toFixed(1)}%
                    </td>
                    <td className={avgR >= 0 ? 'text-success' : 'text-danger'}>
                      {avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R
                    </td>
                    <td className={row.profitFactor >= 1 ? 'text-success' : 'text-danger'}>
                      {profitFactor}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PerformanceBreakdown;
