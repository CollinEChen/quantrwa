'use client';

import Link from 'next/link';
import { AssetAppraisalForm } from './components/AssetAppraisalForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto py-12">
        <div className="mb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">QuantRWA</h1>
          <p className="text-slate-300 max-w-2xl">
            Decentralized real-world asset tokenization with next-gen AI tooling for appraisal and trading.
          </p>
        </div>

        <div className="space-y-8">
            <AssetAppraisalForm />
         

          <div className="bg-slate-950 border border-slate-700 rounded-3xl p-8 text-white shadow-xl">
            <h2 className="text-3xl font-semibold mb-3">AI Trading Dashboard</h2>
            <p className="text-slate-300 max-w-2xl mb-6">
              The trading dashboard is now on its own page for a cleaner experience. Open it to view agent-based trades, market graphs, and live analytics.
            </p>
            <Link href="/trading" className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
              Go to Trading Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
