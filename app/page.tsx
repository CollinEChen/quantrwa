'use client';

import { motion } from 'framer-motion';
import { AssetAppraisalForm } from './components/AssetAppraisalForm';

export default function Home() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen py-12 px-4"
    >
      {/* Hero Section */}
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-teal-500/10 rounded-3xl blur-3xl animate-pulse"></div>

          <h1 className="relative text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight">
            Tokenize Your
            <span className="block bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Assets
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-8 font-light">
            Upload. Appraise. Mint. Trade.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <div className="px-4 py-2 bg-[#0f2744]/60 backdrop-blur-sm border border-teal-500/20 rounded-full text-sm text-teal-300 font-medium">
              AI-Powered Appraisal
            </div>
            <div className="px-4 py-2 bg-[#0f2744]/60 backdrop-blur-sm border border-teal-500/20 rounded-full text-sm text-teal-300 font-medium">
              Blockchain Security
            </div>
            <div className="px-4 py-2 bg-[#0f2744]/60 backdrop-blur-sm border border-teal-500/20 rounded-full text-sm text-teal-300 font-medium">
              Real-Time Trading
            </div>
          </div>
        </motion.div>
      </div>

      {/* Appraisal Form */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <AssetAppraisalForm />
      </motion.div>
    </motion.div>
  );
}
