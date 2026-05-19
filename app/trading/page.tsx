'use client';

import TradingDashboard from '../components/TradingDashboard';

export default function TradingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container mx-auto py-12">
        <div className="rounded-3xl p-0">
          <TradingDashboard />
        </div>
      </div>
    </div>
  );
}
