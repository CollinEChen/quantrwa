'use client';

import { useState, useRef } from 'react';
import { useAppraisal } from '@/lib/hooks/useAppraisal';
import { useMint } from '@/lib/hooks/useMint';

export function AssetAppraisalForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('artwork');
  const [preview, setPreview] = useState<string | null>(null);

  const { appraise, loading, error, result } = useAppraisal();
  const { mint, loading: mintLoading, error: mintError, result: mintResult } = useMint();

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Convert to base64 for API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call appraisal API
    try {
      const appraisalResult = await appraise(base64, assetName, assetCategory);
      console.log('Appraisal succeeded:', appraisalResult);
    } catch (err) {
      console.error('Appraisal failed:', err);
    }
  };

  const handleMint = async () => {
    if (!result) return;

    try {
      await mint(
        assetName,
        assetCategory,
        result.appraisal.estimatedValue,
        result.appraisal.riskScore,
        result.appraisal.condition,
        result.authorization.authorized,
        result.signature
      );
    } catch (err) {
      console.error('Mint failed:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Appraisal Form Card */}
      <div className="bg-[#0f2744]/80 backdrop-blur-sm rounded-2xl border border-teal-500/20 p-8 shadow-lg"
           style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.1)' }}>

        {/* Input Form */}
        <div className="space-y-6 mb-8">
          <div>
            <label className="block text-sm font-display font-semibold mb-3 text-gray-300 uppercase tracking-wider">
              Asset Name
            </label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g., Vintage Rolex Watch"
              className="w-full px-4 py-3 bg-[#0a1628]/60 border border-teal-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-display font-semibold mb-3 text-gray-300 uppercase tracking-wider">
              Category
            </label>
            <select
              value={assetCategory}
              onChange={(e) => setAssetCategory(e.target.value)}
              className="custom-select w-full px-4 py-3 text-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-all duration-200"
            >
              <option value="artwork">Artwork</option>
              <option value="jewelry">Jewelry</option>
              <option value="watch">Watch</option>
              <option value="electronics">Electronics</option>
              <option value="collectible">Collectible</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-display font-semibold mb-3 text-gray-300 uppercase tracking-wider">
              Upload Image
            </label>
            <div
              className="relative border-2 border-dashed border-teal-500/30 rounded-xl p-8 text-center hover:border-teal-400 transition-all duration-200 cursor-pointer bg-[#0a1628]/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={loading || mintLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <svg className="w-12 h-12 text-teal-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-white mb-2">Drop your asset image here</p>
                <p className="text-sm text-gray-400">or click to browse files</p>
              </div>
            </div>
          </div>
        </div>

      {/* Image Preview */}
      {preview && (
        <div className="mb-8">
          <img
            src={preview}
            alt="Asset Preview"
            className="max-w-full h-auto rounded-xl border border-teal-500/20 shadow-lg mx-auto"
            style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.1)' }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mb-6 p-6 bg-[#0a1628]/60 backdrop-blur-sm border border-teal-500/20 rounded-xl text-center"
             style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.1)' }}>
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent"></div>
            <p className="text-teal-400 font-medium">Appraising asset with Gemini Vision...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-6 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl"
             style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)' }}>
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 font-medium">Error: {error.message}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          <div className="bg-[#0a1628]/60 backdrop-blur-sm border border-teal-500/20 rounded-xl p-6"
               style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.1)' }}>
            <h2 className="text-xl font-display font-semibold mb-6 text-white">Appraisal Result</h2>

            {/* Appraisal Details */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-2">Estimated Value</p>
                <p className="text-2xl font-display font-bold text-green-400">
                  ${result.appraisal.estimatedValue.toLocaleString()}
                </p>
              </div>

              <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-2">Risk Score</p>
                <div className="flex items-center space-x-3">
                  <p className="text-2xl font-display font-bold text-orange-400">
                    {result.appraisal.riskScore}/100
                  </p>
                  <div className="flex-1 h-2 bg-[#0a1628] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${result.appraisal.riskScore}%`,
                        backgroundColor: result.appraisal.riskScore < 30 ? '#22c55e' : result.appraisal.riskScore < 70 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-2">Condition</p>
                <p className="text-lg font-semibold text-white">{result.appraisal.condition}</p>
              </div>

              <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-2">Status</p>
                <div className="flex items-center space-x-2">
                  <p className={`text-lg font-semibold ${result.authorization.authorized ? 'text-green-400' : 'text-red-400'}`}>
                    {result.authorization.authorized ? 'Approved' : 'Rejected'}
                  </p>
                  <span className={`text-xl ${result.authorization.authorized ? 'text-green-400' : 'text-red-400'}`}>
                    {result.authorization.authorized ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {result.appraisal.notes && (
              <div className="mb-6">
                <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-2">Notes</p>
                <p className="text-gray-300 bg-[#0f2744]/30 rounded-lg p-3 border border-teal-500/10">{result.appraisal.notes}</p>
              </div>
            )}

            {/* Authorization Details */}
            <div className="border-t border-teal-500/20 pt-6">
              <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-3">Authorization</p>
              <p className="text-gray-300 mb-3">{result.authorization.message}</p>

              {result.signature && (
                <div className="bg-[#0f2744]/30 rounded-lg p-3 border border-teal-500/10">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Signature</p>
                  <p className="font-mono text-xs text-teal-400 break-all">{result.signature}</p>
                </div>
              )}
            </div>

            {/* Mint CTA */}
            {result.authorization.authorized && !mintResult && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={handleMint}
                  disabled={mintLoading}
                  className="w-full px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-display font-semibold rounded-xl hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
                  style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.3)' }}
                >
                  {mintLoading ? (
                    <div className="flex items-center justify-center space-x-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Minting SPL Token...</span>
                    </div>
                  ) : (
                    'Mint SPL Token (10,000 shares)'
                  )}
                </button>
              </div>
            )}

            {mintError && (
              <div className="mt-6 p-6 bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl"
                   style={{ boxShadow: '0 0 20px rgba(239, 68, 68, 0.1)' }}>
                <div className="flex items-center space-x-3">
                  <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 font-medium">Mint Error: {mintError.message}</p>
                </div>
              </div>
            )}

            {mintResult && (
              <div className="mt-6 p-6 bg-[#0a1628]/60 backdrop-blur-sm border border-teal-500/20 rounded-xl"
                   style={{ boxShadow: '0 0 20px rgba(45, 212, 191, 0.1)' }}>
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white">Token Minted Successfully</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                      <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-1">Mint Address</p>
                      <p className="font-mono text-sm text-teal-400 break-all">{mintResult.mintAddress}</p>
                    </div>

                    <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                      <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-1">Transaction Hash</p>
                      <p className="font-mono text-sm text-teal-400 break-all">{mintResult.transactionHash}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                      <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-1">Total Shares</p>
                      <p className="text-lg font-display font-bold text-white">{mintResult.shares.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0f2744]/50 rounded-lg p-4 border border-teal-500/10">
                      <p className="text-sm text-gray-400 uppercase tracking-wider font-display mb-1">Decimals</p>
                      <p className="text-lg font-display font-bold text-white">{mintResult.shareDecimals}</p>
                    </div>
                  </div>

                  <div className="bg-[#0f2744]/30 rounded-lg p-4 border border-teal-500/10">
                    <p className="text-sm text-gray-300">{mintResult.message}</p>
                  </div>

                  {mintResult.mongoSaved === false && (
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="font-semibold text-orange-400">Warning</p>
                          <p className="text-sm text-orange-300">Mint succeeded, but MongoDB logging failed.</p>
                          {mintResult.mongoError && (
                            <p className="text-xs text-orange-200 mt-1">Details: {mintResult.mongoError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
