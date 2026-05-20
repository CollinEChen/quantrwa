import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

interface MarketToken {
  name: string;
  currentPrice: number;
  openingPrice: number;
  change24h: number;
  volume: number;
  holders: number;
  color: string;
  isRWA: boolean;
  isNew: boolean;
}

interface MintRecord {
  assetName?: string;
  assetCategory?: string;
  estimatedValue?: number;
  createdAt?: Date;
}

const TOKEN_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316'];

const sanitizeTokenName = (assetName: string, assetCategory: string): string => {
  const cleanedName = assetName.trim();
  const normalizedName = cleanedName.replace(/\s+/g, '-').toUpperCase();
  const tokenLikePattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

  if (tokenLikePattern.test(normalizedName)) {
    return normalizedName;
  }

  const category = assetCategory.trim().replace(/\s+/g, '-').toUpperCase() || 'RWA';
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${category}-${suffix}`;
};

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const mintsCollection = db.collection<MintRecord>('mints');

    const mintRecords = await mintsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const seen = new Set<string>();
    const deduplicatedMints = mintRecords.filter((mint) => {
      const assetName = String(mint.assetName ?? '').trim();
      if (seen.has(assetName)) {
        return false;
      }
      seen.add(assetName);
      return true;
    });

    const tokens: MarketToken[] = deduplicatedMints.map((record, index) => {
      const assetName = String(record.assetName ?? '').trim();
      const assetCategory = String(record.assetCategory ?? '').trim();
      const estimatedValue = Number(record.estimatedValue ?? 0);
      const name = sanitizeTokenName(assetName || assetCategory || 'RWA', assetCategory || 'RWA');
      const currentPrice = Math.round((estimatedValue / 10000) * 100) / 100;
      const color = TOKEN_COLORS[index % TOKEN_COLORS.length];

      return {
        name,
        currentPrice,
        openingPrice: currentPrice,
        change24h: 0,
        volume: 100,
        holders: 1,
        color,
        isRWA: true,
        isNew: false,
      };
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('[Tokens] GET failed', error);
    return NextResponse.json({ tokens: [] });
  }
}
