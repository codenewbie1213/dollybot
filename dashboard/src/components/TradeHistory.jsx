import React, { useState, useEffect } from 'react';
import { getSignals } from '../services/api';

function TradeHistory() {
  const [signals, setSignals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    symbol: '',
    timeframe: '',
    mode: '',
    outcome: '',
    limit: 50,
    offset: 0,
  });
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchSignals();
  }, [filters]);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const result = await getSignals(filters);
      setSignals(result.signals || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
      setSignals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0, // Reset to first page
    }));
  };

  const handlePagination = (direction) => {
    setFilters(prev => ({
      ...prev,
      offset: direction === 'next'
        ? prev.offset + prev.limit
        : Math.max(0, prev.offset - prev.limit),
    }));
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return price < 10 ? price.toFixed(5) : price.toFixed(2);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-neutral', text: 'Pending' },
      triggered: { class: 'badge-info', text: 'Active' },
      expired: { class: 'badge-muted', text: 'Expired' },
      win: { class: 'badge-success', text: 'Win' },
      loss: { class: 'badge-danger', text: 'Loss' },
      timeout: { class: 'badge-warning', text: 'Timeout' },
    };

    const badge = badges[status] || { class: 'badge-neutral', text: status };
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className="trade-history">
      <div className="filters">
        <select
          value={filters.outcome}
          onChange={(e) => handleFilterChange('outcome', e.target.value)}
          className="filter-select"
        >
          <option value="">All Outcomes</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="timeout">Timeouts</option>
        </select>

        <select
          value={filters.mode}
          onChange={(e) => handleFilterChange('mode', e.target.value)}
          className="filter-select"
        >
          <option value="">All Modes</option>
          <option value="conservative">Conservative</option>
          <option value="aggressive">Aggressive</option>
        </select>

        <select
          value={filters.limit}
          onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          className="filter-select"
        >
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>

        <div className="results-count">
          {total} total signals
        </div>
      </div>

      {loading ? (
        <div className="loading-small">
          <div className="spinner-small"></div>
        </div>
      ) : signals.length === 0 ? (
        <div className="no-data">
          <p>No signals found</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="signals-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Symbol</th>
                  <th>TF</th>
                  <th>Mode</th>
                  <th>Direction</th>
                  <th>Entry</th>
                  <th>SL</th>
                  <th>Status</th>
                  <th>R-Multiple</th>
                  <th>Confidence</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => {
                  const isExpanded = expandedRow === signal.id;
                  const rMultiple = signal.outcome_detail?.rr;

                  return (
                    <React.Fragment key={signal.id}>
                      <tr
                        className={isExpanded ? 'expanded' : ''}
                        onClick={() => toggleRow(signal.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDate(signal.created_at)}</td>
                        <td><strong>{signal.symbol}</strong></td>
                        <td>{signal.timeframe}</td>
                        <td className="text-capitalize">{signal.mode}</td>
                        <td className={`direction-${signal.direction}`}>
                          {signal.direction === 'long' ? '📈' : '📉'} {signal.direction.toUpperCase()}
                        </td>
                        <td>{formatPrice(signal.entry)}</td>
                        <td>{formatPrice(signal.stop_loss)}</td>
                        <td>{getStatusBadge(signal.status)}</td>
                        <td>
                          {rMultiple !== undefined ? (
                            <span className={rMultiple >= 0 ? 'text-success' : 'text-danger'}>
                              {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>{Math.round(signal.confidence * 100)}%</td>
                        <td className="text-muted">{isExpanded ? '▼' : '▶'}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="expanded-row">
                          <td colSpan="11">
                            <div className="expanded-content">
                              <div className="expanded-section">
                                <h4>Take Profits</h4>
                                <div className="tp-list">
                                  {signal.take_profits.map((tp, i) => (
                                    <span key={i} className="tp-badge">
                                      TP{i + 1}: {formatPrice(tp)}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="expanded-section">
                                <h4>Setup Reason</h4>
                                <p>{signal.candidate_reason || 'N/A'}</p>
                              </div>

                              <div className="expanded-section">
                                <h4>AI Analysis</h4>
                                <p>{signal.reason || 'N/A'}</p>
                              </div>

                              {signal.management_hint && (
                                <div className="expanded-section">
                                  <h4>Management Hint</h4>
                                  <p>{signal.management_hint}</p>
                                </div>
                              )}

                              {signal.outcome_detail && (
                                <div className="expanded-section">
                                  <h4>Outcome Detail</h4>
                                  <p>
                                    Hit: <strong>{signal.outcome_detail.hit?.toUpperCase()}</strong> at{' '}
                                    {formatPrice(signal.outcome_detail.hitPrice)}
                                  </p>
                                  {signal.closed_at && (
                                    <p className="text-muted">
                                      Closed: {formatDate(signal.closed_at)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={() => handlePagination('prev')}
              disabled={filters.offset === 0}
              className="btn-pagination"
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePagination('next')}
              disabled={filters.offset + filters.limit >= total}
              className="btn-pagination"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TradeHistory;
