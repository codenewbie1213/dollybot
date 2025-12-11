import React from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>📊 DollyBot Dashboard</h1>
        <p className="subtitle">AI-Powered Trading Signal Analytics</p>
      </header>
      <Dashboard />
    </div>
  );
}

export default App;
