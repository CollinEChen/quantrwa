import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

interface MintRequest {
  assetName: string;
  assetCategory: string;
  estimatedValue: number;
  riskScore: number;
  condition: string;
  authorized: boolean;
  signature?: string;
}

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

/**
 * Generate a fake Solana transaction signature
 * (88-character base58 string)
 */
function generateFakeTransactionSignature(): string {
  const base58Chars =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let signature = '';
  for (let i = 0; i < 88; i++) {
    signature += base58Chars.charAt(
      Math.floor(Math.random() * base58Chars.length)
    );
  }
  return signature;
}

/**
 * Generate a fake SPL token mint address
 * (44-character base58 string)
 */
function generateFakeMintAddress(): string {
  const base58Chars =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let address = '';
  for (let i = 0; i < 44; i++) {
    address += base58Chars.charAt(
      Math.floor(Math.random() * base58Chars.length)
    );
  }
  return address;
}

/**
 * POST /api/mint
 *
 * Flow:
 * 1. Receive appraisal result with Lambda authorization
 * 2. If authorized, generate fake Solana mint
 * 3. Create 10,000 fractional shares
 * 4. Log to MongoDB
 * 5. Return transaction hash and mint details
 */
export async function POST(request: NextRequest) {
  try {
    const body: MintRequest = await request.json();
    const {
      assetName,
      assetCategory,
      estimatedValue,
      riskScore,
      condition,
      authorized,
      signature,
    } = body;

    if (!authorized) {
      return NextResponse.json(
        { error: 'Asset appraisal was not authorized by Lambda' },
        { status: 403 }
      );
    }

    console.log('[Mint] Starting mock Solana mint for:', assetName);

    // Generate fake Solana transaction data
    const transactionHash = generateFakeTransactionSignature();
    const mintAddress = generateFakeMintAddress();
    const shares = 10000;
    const shareDecimals = 2;
    const timestamp = new Date().toISOString();

    let mongoSaved = false;
    let mongoError: string | undefined;

    try {
      const { db } = await connectToDatabase();
      const mintsCollection = db.collection('mints');

      const mintRecord = {
        assetName,
        assetCategory,
        estimatedValue,
        riskScore,
        condition,
        transactionHash,
        mintAddress,
        shares,
        shareDecimals,
        lambdaSignature: signature,
        createdAt: new Date(timestamp),
        status: 'confirmed',
      };

      const result = await mintsCollection.insertOne(mintRecord);
      console.log('[Mint] MongoDB record created:', result.insertedId);

      const auditCollection = db.collection('audit_logs');
      await auditCollection.insertOne({
        action: 'asset_minted',
        assetName,
        mintAddress,
        transactionHash,
        estimatedValue,
        riskScore,
        createdAt: new Date(timestamp),
        mongoId: result.insertedId,
      });

      mongoSaved = true;
    } catch (err) {
      mongoError = err instanceof Error ? err.message : String(err);
      console.error('[Mint] MongoDB save failed:', mongoError);
    }

    const response: MintResult = {
      success: true,
      transactionHash,
      mintAddress,
      shares,
      shareDecimals,
      timestamp,
      message: `Successfully minted ${assetName} as SPL token with ${shares.toLocaleString()} shares${mongoSaved ? '' : ' (MongoDB logging failed, but the mint simulation completed.)'}`,
      mongoSaved,
      mongoError,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Mint] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
