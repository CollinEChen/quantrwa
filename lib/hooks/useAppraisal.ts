import { useState } from 'react';

interface AppraisalResult {
  appraisal: {
    estimatedValue: number;
    riskScore: number;
    condition: string;
    notes: string;
  };
  authorization: {
    authorized: boolean;
    message: string;
  };
  signature?: string;
  transactionHash?: string;
}

interface UseAppraisalOptions {
  onSuccess?: (result: AppraisalResult) => void;
  onError?: (error: Error) => void;
}

export function useAppraisal(options?: UseAppraisalOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<AppraisalResult | null>(null);

  const appraise = async (
    imageBase64: string,
    assetName: string,
    assetCategory: string
  ): Promise<AppraisalResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/appraise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          assetName,
          assetCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data: AppraisalResult = await response.json();
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

  return { appraise, loading, error, result };
}
