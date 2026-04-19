import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AppraisalRequest {
  imageBase64: string;
  assetName: string;
  assetCategory: string;
}

interface GeminiAppraisalResponse {
  estimatedValue: number;
  riskScore: number;
  condition: string;
  notes: string;
}

interface LambdaSignResponse {
  authorized: boolean;
  signature?: string;
  message: string;
  transactionHash?: string;
}

/**
 * POST /api/appraise
 * 
 * Flow:
 * 1. Receive image (base64), asset name, category
 * 2. Call Gemini Vision for appraisal (value + riskScore)
 * 3. Forward appraisal data to AWS Lambda for HMAC signing
 * 4. Lambda returns authorized: true/false and signature
 * 5. Return full response to frontend
 */
export async function POST(request: NextRequest) {
  try {
    const body: AppraisalRequest = await request.json();
    const { imageBase64, assetName, assetCategory } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data (base64) is required' },
        { status: 400 }
      );
    }

    if (!assetName?.trim()) {
      return NextResponse.json(
        { error: 'Asset name is required' },
        { status: 400 }
      );
    }

    if (!assetCategory?.trim()) {
      return NextResponse.json(
        { error: 'Asset category is required' },
        { status: 400 }
      );
    }

    // Step 1: Call Gemini Vision to appraise the asset
    console.log('[Appraise] Calling Gemini Vision for:', assetName);
    
    let appraisal: GeminiAppraisalResponse;
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      
      const geminiResponse = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
        {
          text: `You are an expert asset appraiser. Analyze this ${assetCategory} image and provide:
1. Estimated market value in USD (integer, be conservative)
2. Risk score 0-100 (0=very safe, 100=very risky). Consider: condition, authenticity risk, market volatility
3. Current condition (Excellent/Good/Fair/Poor)
4. Brief notes

Return ONLY valid JSON with keys: estimatedValue, riskScore, condition, notes`,
        },
      ]);

      const geminiText = geminiResponse.response.text();
      console.log('[Appraise] Gemini response:', geminiText);

      // Parse Gemini response (extract JSON)
      try {
        appraisal = JSON.parse(geminiText);
      } catch {
        // Fallback: try to extract JSON from the response
        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Failed to parse Gemini appraisal response');
        }
        appraisal = JSON.parse(jsonMatch[0]);
      }
    } catch (geminiError) {
      console.warn('[Appraise] Gemini failed, using mock appraisal:', geminiError);
      
      // Mock appraisal data for demo purposes
      const mockValues = {
        artwork: { value: 2500, risk: 15 },
        jewelry: { value: 1800, risk: 20 },
        watch: { value: 3200, risk: 25 },
        electronics: { value: 850, risk: 35 },
        collectible: { value: 1200, risk: 30 },
      };
      
      const categoryData = mockValues[assetCategory as keyof typeof mockValues] || mockValues.artwork;
      
      appraisal = {
        estimatedValue: categoryData.value,
        riskScore: categoryData.risk,
        condition: 'Good',
        notes: `Mock appraisal for ${assetCategory} - Gemini API unavailable. This is simulated data for demo purposes.`,
      };
    }

    // Validate appraisal response
    if (
      typeof appraisal.estimatedValue !== 'number' ||
      typeof appraisal.riskScore !== 'number'
    ) {
      return NextResponse.json(
        { error: 'Invalid appraisal response format' },
        { status: 500 }
      );
    }

    const normalizedRiskScore = Number(appraisal.riskScore);
    const normalizedValue = Number(appraisal.estimatedValue);

    // Step 2: Forward to Lambda for signing
    console.log('[Appraise] Forwarding to Lambda:', {
      assetName,
      assetCategory,
      estimatedValue: normalizedValue,
      riskScore: normalizedRiskScore,
      condition: appraisal.condition,
    });

    const lambdaUrl = process.env.LAMBDA_FUNCTION_URL;
    if (!lambdaUrl) {
      return NextResponse.json(
        { error: 'Lambda URL not configured' },
        { status: 500 }
      );
    }

    const timestamp = new Date().toISOString();
    const lambdaPayload = {
      assetName,
      asset_category: assetCategory,
      assetCategory,
      estimated_value: normalizedValue,
      estimatedValue: normalizedValue,
      risk_score: normalizedRiskScore,
      riskScore: normalizedRiskScore,
      condition: appraisal.condition,
      timestamp,
      created_at: timestamp,
    };

    console.log('[Appraise] Lambda payload:', lambdaPayload);

    const lambdaResponse = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lambdaPayload),
    });

    let lambdaResult: LambdaSignResponse;
    if (lambdaResponse.ok) {
      lambdaResult = await lambdaResponse.json();
    } else {
      // Handle Lambda rejection as authorization failure
      const errorData = await lambdaResponse.json().catch(() => ({}));
      lambdaResult = {
        authorized: false,
        message: errorData.error || `Lambda rejected with status ${lambdaResponse.status}`,
      };
    }

    console.log('[Appraise] Lambda response:', lambdaResult);

    // Step 3: Return combined result to frontend
    const result = {
      appraisal: {
        estimatedValue: appraisal.estimatedValue,
        riskScore: appraisal.riskScore,
        condition: appraisal.condition,
        notes: appraisal.notes,
      },
      authorization: {
        authorized: lambdaResult.authorized,
        message: lambdaResult.message,
      },
      signature: lambdaResult.signature,
      transactionHash: lambdaResult.transactionHash,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Appraise] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
