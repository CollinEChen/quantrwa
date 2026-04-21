'use client';

import { AssetAppraisalForm } from './components/AssetAppraisalForm';
import TradingDashboard from './components/TradingDashboard';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">QuantRWA</h1>
          <p className="text-slate-300">Decentralized Real-World Asset Tokenization</p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-lg">
            <AssetAppraisalForm />
          </div>

          <TradingDashboard />
        </div>
      </div>
    </div>
  );
}
