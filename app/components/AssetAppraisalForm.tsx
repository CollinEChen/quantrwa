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
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Asset Appraisal</h1>

      {/* Input Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Asset Name</label>
          <input
            type="text"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            placeholder="e.g., Vintage Rolex Watch"
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <select
            value={assetCategory}
            onChange={(e) => setAssetCategory(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="artwork">Artwork</option>
            <option value="jewelry">Jewelry</option>
            <option value="watch">Watch</option>
            <option value="electronics">Electronics</option>
            <option value="collectible">Collectible</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Upload Image</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={loading || mintLoading}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Image Preview */}
      {preview && (
        <div className="mb-6">
          <img
            src={preview}
            alt="Preview"
            className="max-w-full h-auto rounded-lg max-h-96"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-4 bg-blue-50 text-blue-700 rounded-lg">
          Appraising asset with Gemini Vision...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Error: {error.message}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <h2 className="text-lg font-bold mb-4 text-green-900">Appraisal Result</h2>

            {/* Appraisal Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Estimated Value</p>
                <p className="text-2xl font-bold text-green-700">
                  ${result.appraisal.estimatedValue.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Risk Score</p>
                <p className="text-2xl font-bold text-orange-700">
                  {result.appraisal.riskScore}/100
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Condition</p>
                <p className="text-lg font-semibold">{result.appraisal.condition}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p
                  className={`text-lg font-semibold ${
                    result.authorization.authorized ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {result.authorization.authorized ? 'Approved ✓' : 'Rejected ✗'}
                </p>
              </div>
            </div>

            {/* Notes */}
            {result.appraisal.notes && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-gray-800">{result.appraisal.notes}</p>
              </div>
            )}

            {/* Authorization Details */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-1">Authorization</p>
              <p className="text-gray-800">{result.authorization.message}</p>
              
              {result.signature && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 truncate">
                    Signature: {result.signature}
                  </p>
                </div>
              )}
            </div>

            {/* Mint CTA */}
            {result.authorization.authorized && !mintResult && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleMint}
                  disabled={mintLoading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {mintLoading ? 'Minting SPL Token...' : 'Mint SPL Token (10,000 shares)'}
                </button>
              </div>
            )}

            {mintError && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                Mint Error: {mintError.message}
              </div>
            )}

            {mintResult && (
              <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-bold text-purple-900 mb-4">Token Minted</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Mint Address</p>
                    <p className="font-mono text-sm text-purple-700 break-all">{mintResult.mintAddress}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Transaction Hash</p>
                    <p className="font-mono text-sm text-purple-700 break-all">{mintResult.transactionHash}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-sm text-gray-600">Total Shares</p>
                      <p className="text-lg font-bold text-purple-700">{mintResult.shares.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Decimals</p>
                      <p className="text-lg font-bold text-purple-700">{mintResult.shareDecimals}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-purple-200">
                    <p className="text-sm text-gray-700">{mintResult.message}</p>
                  </div>

                  {mintResult.mongoSaved === false && (
                    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                      <p className="font-semibold">Warning:</p>
                      <p>Mint succeeded, but MongoDB logging failed.</p>
                      {mintResult.mongoError && (
                        <p className="mt-1 text-xs text-orange-700">Details: {mintResult.mongoError}</p>
                      )}
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
