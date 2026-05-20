import { NextRequest, NextResponse } from 'next/server';
import { FunctionCallingMode, GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface MarketPrice {
  tokenName: string;
  currentPrice: number;
  change24h: number;
}

interface Holding {
  shares: number;
  avgCostPerShare: number;
  currentPrice: number;
}

interface Portfolio {
  cashBalance: number;
  holdings: Record<string, Holding>;
  totalValue: number;
}

interface RecentTrade {
  asset: string;
  type: string;
  price: number;
  quantity: number;
  timestamp: string;
}

interface AgentRequest {
  agentName: string;
  agentStrategy: string;
  aggression: number;
  marketPrices: MarketPrice[];
  portfolio: Portfolio;
  recentTrades: RecentTrade[];
}

interface ExecuteTradeArgs {
  action: 'buy' | 'sell' | 'hold';
  token: string;
  amount: number;
  reasoning: string;
  confidence: number;
}

const executeTradeTool = {
  functionDeclarations: [
    {
      name: 'executeTrade',
      description: 'Decide whether to buy, sell, or hold a token based on market data, portfolio state, and agent aggression.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          action: {
            type: SchemaType.STRING,
            description: 'Trade action to take.',
            enum: ['buy', 'sell', 'hold'],
          },
          token: {
            type: SchemaType.STRING,
            description: 'Token symbol to trade.',
          },
          amount: {
            type: SchemaType.NUMBER,
            description: 'Number of shares to buy or sell.',
          },
          reasoning: {
            type: SchemaType.STRING,
            description: 'One-sentence explanation for the decision.',
          },
          confidence: {
            type: SchemaType.NUMBER,
            description: 'Confidence percentage for the decision, from 0 to 100.',
          },
        },
        required: ['action', 'token', 'amount', 'reasoning', 'confidence'],
      },
    },
  ],
};

const buildPrompt = ({
  agentName,
  agentStrategy,
  aggression,
  marketPrices,
  portfolio,
  recentTrades,
}: AgentRequest) => {
  const priceLines = marketPrices
    .map(
      (price) =>
        `- ${price.tokenName}: $${price.currentPrice.toFixed(2)} (${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(
          2
        )}%)`
    )
    .join('\n');

  const holdingLines = Object.entries(portfolio.holdings)
    .map(
      ([tokenName, holding]) =>
        `- ${tokenName}: ${holding.shares} shares @ $${holding.avgCostPerShare.toFixed(2)} avg cost, current $${holding.currentPrice.toFixed(
          2
        )}`
    )
    .join('\n');

  const tradeLines = recentTrades
    .slice(0, 5)
    .map(
      (trade) =>
        `- ${trade.timestamp}: ${trade.type.toUpperCase()} ${trade.quantity} ${trade.asset} @ $${trade.price.toFixed(2)}`
    )
    .join('\n');

  return `You are ${agentName}, an AI trading agent with the following strategy:

${agentStrategy}

Aggression level: ${aggression} (higher aggression means larger positions and faster reactions).

Current market prices:
${priceLines}

Portfolio summary:
- Cash balance: $${portfolio.cashBalance.toFixed(2)}
- Total portfolio value: $${portfolio.totalValue.toFixed(2)}
- Holdings:
${holdingLines || '- none'}

Most recent trades:
${tradeLines || '- none'}

Rules:
1. Do not sell more shares than are currently held for any token.
2. Do not spend more cash than is available in the portfolio.
3. Higher aggression should favor larger position sizes and stronger directional conviction.
4. Avoid over-concentration in any single token; prefer diversification when possible.
5. If there is insufficient cash for a buy, choose hold or a smaller position.
6. If there are no strong trade opportunities, choose hold.

Use the executeTrade tool to return a single trade decision if appropriate.
Only use the tool with valid JSON arguments matching the schema. Provide action, token, amount, reasoning, and confidence. Use "hold" when no trade is recommended.
`;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequest;

    if (
      !body ||
      typeof body.agentName !== 'string' ||
      typeof body.agentStrategy !== 'string' ||
      typeof body.aggression !== 'number' ||
      !Array.isArray(body.marketPrices) ||
      typeof body.portfolio !== 'object' ||
      !Array.isArray(body.recentTrades)
    ) {
      return NextResponse.json({ decisions: [] });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = buildPrompt(body);

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      tools: [executeTradeTool],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.ANY,
          allowedFunctionNames: ['executeTrade'],
        },
      },
      generationConfig: {
        maxOutputTokens: 400,
      },
    });

    const functionCalls = response.response.functionCalls?.() ?? [];
    const parsedDecisions = functionCalls.map((call) => ({
      name: call.name,
      args: call.args,
    }));

    return NextResponse.json({ decisions: parsedDecisions });
  } catch (error) {
    console.error('[Agent] Error generating trade decision', error);
    return NextResponse.json({ decisions: [] });
  }
}
