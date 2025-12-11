import React from 'react';

function StatsCards({ stats }) {
  if (!stats) {
    return <div className="stats-cards">No data available</div>;
  }

  const { totalTrades, wins, losses, winrate, avgR, profitFactor } = stats;

  const cards = [
    {
      label: 'Total Trades',
      value: totalTrades,
      format: (v) => v,
      className: 'card-neutral',
    },
    {
      label: 'Win Rate',
      value: winrate,
      format: (v) => `${(v * 100).toFixed(1)}%`,
      className: winrate >= 0.5 ? 'card-success' : 'card-danger',
      subtitle: `${wins}W / ${losses}L`,
    },
    {
      label: 'Average R',
      value: avgR,
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`,
      className: avgR >= 0 ? 'card-success' : 'card-danger',
    },
    {
      label: 'Profit Factor',
      value: profitFactor,
      format: (v) => v >= 999 ? '∞' : v.toFixed(2),
      className: profitFactor >= 1 ? 'card-success' : 'card-danger',
    },
  ];

  return (
    <div className="stats-cards">
      {cards.map((card, index) => (
        <div key={index} className={`stats-card ${card.className}`}>
          <div className="card-label">{card.label}</div>
          <div className="card-value">{card.format(card.value)}</div>
          {card.subtitle && (
            <div className="card-subtitle">{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
