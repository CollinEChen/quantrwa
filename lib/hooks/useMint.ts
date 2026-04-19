import { useState } from 'react';

interface MintResult {
  success: boolean;
  transactionHash: string;
  mintAddress: string;
  shares: number;
  shareDecimals: number;
  timestamp: string;
  message: string;
  mongoSaved?: boolean;
  mongoError?: string;
}

interface UseMintOptions {
  onSuccess?: (result: MintResult) => void;
  onError?: (error: Error) => void;
}

export function useMint(options?: UseMintOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const mint = async (
    assetName: string,
    assetCategory: string,
    estimatedValue: number,
    riskScore: number,
    condition: string,
    authorized: boolean,
    signature?: string
  ): Promise<MintResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assetName,
          assetCategory,
          estimatedValue,
          riskScore,
          condition,
          authorized,
          signature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data: MintResult = await response.json();
      setResult(data);
      options?.onSuccess?.(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { mint, loading, error, result };
}
