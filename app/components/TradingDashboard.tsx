'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface Trade {
  id: string;
  asset: string;
  price: number;
  type: 'buy' | 'sell';
  timestamp: Date;
  quantity: number;
}

interface PnLData {
  time: string;
  value: number;
}

interface AgentDefinition {
  name: string;
  description: string;
  aggression: 'High' | 'Medium' | 'Low';
  tradeFrequency: number;
  baseVolatility: number;
  bias: 'buy' | 'balanced' | 'sell';
  defaultAggression: number;
  color: string;
}

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

interface MintEvent {
  tokenName: string;
  startingPrice: number;
  timestamp: string;
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

interface ExecuteTradeArgs {
  action: 'buy' | 'sell' | 'hold';
  token: string;
  amount: number;
  reasoning: string;
  confidence: number;
}

interface TradingDashboardProps {
  onMintReceived?: (mint: MintEvent) => void;
}

const AGENTS: AgentDefinition[] = [
  {
    name: 'Aether',
    description: 'Follows price trends, buys highs, sells higher',
    aggression: 'High',
    tradeFrequency: 60000,
    baseVolatility: 0.012,
    bias: 'buy',
    defaultAggression: 80,
    color: '#22c55e',
  },
  {
    name: 'Solon',
    description: 'Buys dips, sells recoveries',
    aggression: 'Medium',
    tradeFrequency: 60000,
    baseVolatility: 0.007,
    bias: 'balanced',
    defaultAggression: 50,
    color: '#3b82f6',
  },
  {
    name: 'Zephyr',
    description: 'Scalps small price movements across high volume tokens',
    aggression: 'Low',
    tradeFrequency: 60000,
    baseVolatility: 0.003,
    bias: 'sell',
    defaultAggression: 25,
    color: '#f59e0b',
  },
];

const INITIAL_TOKENS: MarketToken[] = [
  {
    name: 'SOL',
    currentPrice: 148.3,
    openingPrice: 148.3,
    change24h: 1.2,
    volume: 7500,
    holders: 8800,
    color: '#10b981',
    isRWA: false,
    isNew: false,
  },
  {
    name: 'USDC',
    currentPrice: 1.0,
    openingPrice: 1.0,
    change24h: 0.0,
    volume: 24200,
    holders: 15000,
    color: '#60a5fa',
    isRWA: false,
    isNew: false,
  },
];

const makeGraphRow = (tokens: MarketToken[]) => {
  const row: Record<string, string | number> = { time: new Date().toLocaleTimeString() };
  tokens.forEach((token) => {
    row[token.name] = token.currentPrice;
  });
  return row;
};

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const getLineColor = (currentPrice: number, openingPrice: number): string => {
  return currentPrice >= openingPrice ? '#22c55e' : '#ef4444';
};

const getAreaFill = (currentPrice: number, openingPrice: number): string => {
  return currentPrice >= openingPrice ? '#22c55e' : '#ef4444';
};

export default function TradingDashboard({ onMintReceived }: TradingDashboardProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnlData, setPnlData] = useState<PnLData[]>([]);
  const [marketTokens, setMarketTokens] = useState<MarketToken[]>(INITIAL_TOKENS);
  const [graphData, setGraphData] = useState<Record<string, string | number>[]>([makeGraphRow(INITIAL_TOKENS)]);
  const [solPrice, setSolPrice] = useState<{ usd: number; usd_24h_change: number } | null>(null);
  const [tokensLoading, setTokensLoading] = useState<boolean>(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition>(AGENTS[0]);
  const [aggression, setAggression] = useState<number>(AGENTS[0].defaultAggression);
  const [agentConfidence, setAgentConfidence] = useState<number>(72);
  const [portfolio, setPortfolio] = useState<Portfolio>({
    cashBalance: 10000,
    holdings: {},
    totalValue: 10000,
  });
  const [agentRunning, setAgentRunning] = useState<boolean>(false);
  const [agentThinking, setAgentThinking] = useState<boolean>(false);
  const [lastAgentReasoning, setLastAgentReasoning] = useState<string>('');
  const [reasoningLog, setReasoningLog] = useState<{
    timestamp: string
    agentName: string
    action: string
    token: string
    amount: number
    reasoning: string
    confidence: number
  }[]>([]);

  const aggressionRef = useRef<number>(AGENTS[0].defaultAggression);
  const selectedAgentRef = useRef<AgentDefinition>(AGENTS[0]);
  const marketTokensRef = useRef<MarketToken[]>(INITIAL_TOKENS);
  const portfolioRef = useRef<Portfolio>({
    cashBalance: 10000,
    holdings: {},
    totalValue: 10000,
  });
  const agentLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rwaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cryptoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pnlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const rwaTokens = useMemo(() => marketTokens.filter((token) => token.isRWA), [marketTokens]);

  const applyTradeToPortfolio = (decision: {
    action: 'buy' | 'sell' | 'hold';
    token: string;
    amount: number;
    reasoning: string;
    confidence: number;
  }) => {
    const currentPortfolio = portfolioRef.current;
    let updatedPortfolio = { ...currentPortfolio, holdings: { ...currentPortfolio.holdings } };

    const tokenData = marketTokensRef.current.find((t) => t.name === decision.token);
    if (!tokenData) return;

    const currentPrice = tokenData.currentPrice;

    if (decision.action === 'buy') {
      const cost = decision.amount * currentPrice;
      if (cost > updatedPortfolio.cashBalance) return;

      updatedPortfolio.cashBalance -= cost;
      if (!updatedPortfolio.holdings[decision.token]) {
        updatedPortfolio.holdings[decision.token] = {
          shares: decision.amount,
          avgCostPerShare: currentPrice,
          currentPrice,
        };
      } else {
        const holding = updatedPortfolio.holdings[decision.token];
        const totalCost = holding.shares * holding.avgCostPerShare + cost;
        holding.shares += decision.amount;
        holding.avgCostPerShare = totalCost / holding.shares;
        holding.currentPrice = currentPrice;
      }
    } else if (decision.action === 'sell') {
      const holding = updatedPortfolio.holdings[decision.token];
      if (!holding || holding.shares < decision.amount) return;

      const proceeds = decision.amount * currentPrice;
      updatedPortfolio.cashBalance += proceeds;
      holding.shares -= decision.amount;

      if (holding.shares === 0) {
        delete updatedPortfolio.holdings[decision.token];
      } else {
        holding.currentPrice = currentPrice;
      }
    }

    // Recalculate totalValue
    let totalHoldingsValue = 0;
    Object.values(updatedPortfolio.holdings).forEach((holding) => {
      totalHoldingsValue += holding.shares * holding.currentPrice;
    });
    updatedPortfolio.totalValue = updatedPortfolio.cashBalance + totalHoldingsValue;

    portfolioRef.current = updatedPortfolio;
    setPortfolio(updatedPortfolio);
  };

  const runAgentCycle = async () => {
    setAgentThinking(true);
    console.log('[Gemini] Starting agent cycle...');
    try {
      const marketPrices = marketTokensRef.current.map((token) => ({
        tokenName: token.name,
        currentPrice: token.currentPrice,
        change24h: token.change24h,
      }));

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: selectedAgentRef.current.name,
          agentStrategy: selectedAgentRef.current.description,
          aggression: aggressionRef.current,
          marketPrices,
          portfolio: portfolioRef.current,
          recentTrades: (trades ?? []).slice(0, 5).map((t) => ({
            asset: t.asset,
            type: t.type ?? 'buy',
            price: t.price,
            quantity: t.quantity,
            timestamp: t.timestamp instanceof Date
              ? t.timestamp.toISOString()
              : new Date().toISOString(),
          })),
        }),
      });

      if (!response.ok) {
        console.error('[Gemini Agent] API returned error status:', response.status);
        setAgentThinking(false);
        return;
      }

      const data = await response.json();
      console.log('[Gemini] Response:', JSON.stringify(data));
      const decisions = Array.isArray(data?.decisions) ? data.decisions : [];

      decisions.forEach((decision: { name: string; args: ExecuteTradeArgs }) => {
        const args = decision.args
        if (!args || !args.action) return
        applyTradeToPortfolio(args)
        if (args.action !== 'hold') {
          setTrades((prev) => [
            {
              id: Math.random().toString(36).slice(2, 12),
              asset: args.token,
              price: marketTokensRef.current.find((t) => t.name === args.token)?.currentPrice || 0,
              type: args.action as 'buy' | 'sell',
              timestamp: new Date(),
              quantity: args.amount,
            },
            ...prev,
          ].slice(0, 20))
        }
        setAgentConfidence(args.confidence)
        setLastAgentReasoning(args.reasoning)
        setReasoningLog((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            agentName: selectedAgentRef.current.name,
            action: args.action,
            token: args.token,
            amount: args.amount,
            reasoning: args.reasoning,
            confidence: args.confidence,
          },
          ...prev,
        ].slice(0, 20))
      });
    } catch (error) {
      console.error('[Gemini Agent] Error running cycle:', error);
    } finally {
      setAgentThinking(false);
    }
  };

  const updateMarketState = (nextTokens: MarketToken[]) => {
    marketTokensRef.current = nextTokens;
    setMarketTokens(nextTokens);
    setGraphData((prev) => [...prev, makeGraphRow(nextTokens)].slice(-50));
  };

  const currentBiasChance = () => {
    const latest = selectedAgentRef.current;
    if (latest.bias === 'buy') return 0.6;
    if (latest.bias === 'sell') return 0.4;
    return 0.5;
  };

  const generateTrade = (): Trade => {
    const latest = selectedAgentRef.current;
    const useRwa = Math.random() < (latest.bias === 'buy' ? 0.7 : latest.bias === 'sell' ? 0.35 : 0.55);
    const pool = useRwa ? rwaTokens : marketTokensRef.current;
    const candidate = pool[Math.floor(Math.random() * pool.length)] || marketTokensRef.current[0];
    const type = Math.random() < currentBiasChance() ? 'buy' : 'sell';
    const price = Math.round(candidate.currentPrice * (0.97 + Math.random() * 0.06) * 100) / 100;

    return {
      id: Math.random().toString(36).slice(2, 12),
      asset: candidate.name,
      price,
      type,
      timestamp: new Date(),
      quantity: Math.floor(Math.random() * 8) + 1,
    };
  };

  const applyPriceMove = (token: MarketToken) => {
    const latest = selectedAgentRef.current;
    const volatility = latest.baseVolatility * (aggressionRef.current / 100);
    const change = (Math.random() - 0.5) * 2 * volatility;
    const nextPrice = Math.max(0.01, token.currentPrice * (1 + change));
    const nextChange = Math.max(-12, Math.min(12, token.change24h + (Math.random() - 0.5) * 1.5));
    const nextVolume = Math.max(100, token.volume + Math.round((Math.random() - 0.5) * 120));
    const nextHolders = Math.max(50, token.holders + Math.round((Math.random() - 0.5) * 12));

    return {
      ...token,
      currentPrice: Math.round(nextPrice * 100) / 100,
      change24h: Math.round(nextChange * 10) / 10,
      volume: nextVolume,
      holders: nextHolders,
    };
  };

  const updateTokensByScope = (scope: 'RWA' | 'CRYPTO') => {
    updateMarketState(
      marketTokensRef.current.map((token) => {
        if ((scope === 'RWA' && !token.isRWA) || (scope === 'CRYPTO' && token.isRWA)) {
          return token;
        }
        return applyPriceMove(token);
      })
    );
  };

  const updatePnl = () => {
    setPnlData((prev) => {
      const lastValue = prev.length > 0 ? prev[prev.length - 1].value : 10000;
      const volatility = selectedAgentRef.current.baseVolatility * (aggressionRef.current / 100) * 40;
      const change = (Math.random() - 0.5) * 2 * volatility * 100;
      const nextValue = Math.max(0, lastValue + change);
      return [...prev, { time: new Date().toLocaleTimeString(), value: Math.round(nextValue * 100) / 100 }].slice(-50);
    });
  };

  const clearAllTimers = () => {
    if (tradeTimerRef.current) {
      clearInterval(tradeTimerRef.current);
      tradeTimerRef.current = null;
    }
    if (rwaTimerRef.current) {
      clearTimeout(rwaTimerRef.current);
      rwaTimerRef.current = null;
    }
    if (cryptoTimerRef.current) {
      clearTimeout(cryptoTimerRef.current);
      cryptoTimerRef.current = null;
    }
    if (pnlTimerRef.current) {
      clearTimeout(pnlTimerRef.current);
      pnlTimerRef.current = null;
    }
  };

  const scheduleRwaUpdate = () => {
    if (rwaTimerRef.current) {
      clearTimeout(rwaTimerRef.current);
    }
    const delay = randomBetween(8000, 15000);
    rwaTimerRef.current = setTimeout(() => {
      updateTokensByScope('RWA');
      scheduleRwaUpdate();
    }, delay);
  };

  const scheduleCryptoUpdate = () => {
    if (cryptoTimerRef.current) {
      clearTimeout(cryptoTimerRef.current);
    }
    const delay = randomBetween(3000, 5000);
    cryptoTimerRef.current = setTimeout(() => {
      updateTokensByScope('CRYPTO');
      scheduleCryptoUpdate();
    }, delay);
  };

  const schedulePnlUpdate = () => {
    if (pnlTimerRef.current) {
      clearTimeout(pnlTimerRef.current);
    }
    const delay = randomBetween(5000, 10000);
    pnlTimerRef.current = setTimeout(() => {
      updatePnl();
      schedulePnlUpdate();
    }, delay);
  };

  const refreshTradeTicker = () => {
    if (tradeTimerRef.current) {
      clearInterval(tradeTimerRef.current);
    }

    tradeTimerRef.current = setInterval(() => {
      const newTrade = generateTrade();
      setTrades((prev) => [newTrade, ...prev].slice(0, 20));
    }, selectedAgent.tradeFrequency);
  };

  const handleAgentChange = (agentName: string) => {
    const nextAgent = AGENTS.find((agent) => agent.name === agentName) ?? AGENTS[0];
    selectedAgentRef.current = nextAgent;
    setSelectedAgent(nextAgent);
    setAggression(nextAgent.defaultAggression);
    aggressionRef.current = nextAgent.defaultAggression;
    setAgentConfidence(70);
  };

  const handleMintEvent = (mint: MintEvent) => {
    const timestamp = new Date(mint.timestamp);
    const startingPrice = Math.round(mint.startingPrice * 100) / 100;
    const nextToken: MarketToken = {
      name: mint.tokenName,
      currentPrice: startingPrice,
      openingPrice: startingPrice,
      change24h: 0,
      volume: Math.max(120, Math.round(mint.startingPrice * 14)),
      holders: 220,
      color: '#ec4899',
      isRWA: true,
      isNew: true,
    };

    setTrades((prev) => [
      {
        id: Math.random().toString(36).slice(2, 12),
        asset: mint.tokenName,
        price: nextToken.currentPrice,
        type: 'buy' as const,
        timestamp,
        quantity: Math.max(1, Math.round(nextToken.currentPrice / 250)),
      },
      ...prev,
    ].slice(0, 20));

    setMarketTokens((prev) => {
      const exists = prev.some((token) => token.name === mint.tokenName);
      const nextTokens = exists
        ? prev.map((token) => (token.name === mint.tokenName ? { ...token, currentPrice: nextToken.currentPrice, isNew: true } : token))
        : [nextToken, ...prev];
      marketTokensRef.current = nextTokens;
      return nextTokens;
    });

    setGraphData((prev) => [...prev, makeGraphRow(marketTokensRef.current)].slice(-50));

    if (badgeTimersRef.current[mint.tokenName]) {
      clearTimeout(badgeTimersRef.current[mint.tokenName]);
    }

    badgeTimersRef.current[mint.tokenName] = setTimeout(() => {
      setMarketTokens((prev) => {
        const nextTokens = prev.map((token) => (token.name === mint.tokenName ? { ...token, isNew: false } : token));
        marketTokensRef.current = nextTokens;
        return nextTokens;
      });
    }, 5000);

    onMintReceived?.(mint);
  };

  useEffect(() => {
    marketTokensRef.current = INITIAL_TOKENS;
    setPnlData([
      {
        time: new Date().toLocaleTimeString(),
        value: 10000,
      },
    ]);


    const statusInterval = setInterval(() => {
      setAgentConfidence((prev) => Math.max(15, Math.min(95, prev + (Math.random() - 0.5) * 8)));
    }, 5000);

    const mintListener = (event: Event) => {
      const customEvent = event as CustomEvent<MintEvent>;
      if (customEvent?.detail) {
        handleMintEvent(customEvent.detail);
      }
    };

    window.addEventListener('mint-received', mintListener as EventListener);

    return () => {
      clearAllTimers();
      clearInterval(statusInterval);
      window.removeEventListener('mint-received', mintListener as EventListener);
      Object.values(badgeTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!agentRunning) return
    if (tradeTimerRef.current) {
      clearInterval(tradeTimerRef.current)
      tradeTimerRef.current = null
    }
  }, [selectedAgent]);

  // Fetch real SOL price from CoinGecko on mount and every 30s
  useEffect(() => {
    let mounted = true;

    const fetchSol = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data?.solana) {
          setSolPrice({ usd: Number(data.solana.usd), usd_24h_change: Number(data.solana.usd_24h_change) });
        }
      } catch (e) {
        console.warn('Failed to fetch SOL price', e);
      }
    };

    fetchSol();
    const id = setInterval(fetchSol, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setTokensLoading(true);
        const res = await fetch('/api/tokens');
        const { tokens } = await res.json();
        const rwaTokens = Array.isArray(tokens) ? tokens : [];
        const merged = [...rwaTokens, ...INITIAL_TOKENS];
        updateMarketState(merged);
      } catch {
        // on failure just keep SOL and USDC
      } finally {
        setTokensLoading(false);
      }
    };

    fetchTokens();
  }, []);

  // When solPrice updates, update the SOL token in the market state so graph/table reflect live price
  useEffect(() => {
    if (!solPrice) return;
    const nextTokens = marketTokensRef.current.map((token) => {
      if (token.name === 'SOL') {
        return {
          ...token,
          currentPrice: Math.round(solPrice.usd * 100) / 100,
          change24h: Math.round(solPrice.usd_24h_change * 100) / 100,
        };
      }
      return token;
    });
    updateMarketState(nextTokens);
  }, [solPrice]);

  useEffect(() => {
    if (agentRunning) {
      if (tradeTimerRef.current) {
        clearInterval(tradeTimerRef.current)
        tradeTimerRef.current = null
      }
      scheduleRwaUpdate()
      scheduleCryptoUpdate()
      schedulePnlUpdate()
    } else {
      clearAllTimers()
    }
    return () => clearAllTimers()
  }, [agentRunning]);

  useEffect(() => {
    if (!agentRunning) {
      if (agentLoopRef.current) {
        clearInterval(agentLoopRef.current);
        agentLoopRef.current = null;
      }
      return;
    }
    runAgentCycle();
    agentLoopRef.current = setInterval(runAgentCycle, 60000);
    return () => {
      if (agentLoopRef.current) {
        clearInterval(agentLoopRef.current);
        agentLoopRef.current = null;
      }
    };
  }, [agentRunning]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setAggression(value);
    aggressionRef.current = value;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Trading Dashboard</h1>
            <p className="text-slate-400 mt-1">Visualize RWA and crypto trading activity with live simulations.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label htmlFor="agent-select" className="text-sm text-slate-400">Active AI Agent</label>
              <select
                id="agent-select"
                value={selectedAgent.name}
                onChange={(event) => handleAgentChange(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-inner outline-none focus:border-cyan-500"
              >
                {AGENTS.map((agent) => (
                  <option key={agent.name} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-inner">
              <div className="text-sm text-slate-400 mb-2">Aggression</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Conservative</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={aggression}
                  onChange={handleSliderChange}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-cyan-400"
                />
                <span className="text-xs text-slate-500">Aggressive</span>
              </div>
              <div className="mt-2 text-right text-sm text-slate-300">{aggression}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Portfolio P&L</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Live value tracker</h2>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-sm font-semibold" style={{ backgroundColor: selectedAgent.color, color: '#020617' }}>
                    {selectedAgent.aggression}
                  </div>
                </div>

                <div className="mt-6 h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} />
                      <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: '#94a3b8' }} domain={['dataMin - 100', 'dataMax + 100']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 10 }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Line type="linear" dataKey="value" stroke={selectedAgent.color} strokeWidth={1} dot={false} activeDot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedAgent.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Agent</p>
                        <h3 className="mt-2 text-2xl font-semibold text-white">{selectedAgent.name}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-2xl" style={{ backgroundColor: selectedAgent.color }} />
                    </div>

                    <div className="space-y-2 rounded-3xl bg-slate-950/80 p-4 border border-slate-800">
                      <p className="text-sm text-slate-400">{selectedAgent.description}</p>
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>Trade frequency</span>
                          <span>{selectedAgent.tradeFrequency / 1000}s</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>Aggression</span>
                          <span>{selectedAgent.defaultAggression}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>Bias</span>
                          <span className="capitalize">{selectedAgent.bias}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-3xl bg-slate-950/80 p-4 border border-slate-800">
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Confidence</span>
                        <span className="text-white">{Math.round(agentConfidence)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 rounded-full bg-slate-800 p-1">
                          <motion.div
                            className="h-3 rounded-full"
                            animate={{ width: `${agentConfidence}%`, backgroundColor: selectedAgent.color }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6">
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white">Market Price Chart</h2>
                <p className="mt-2 text-sm text-slate-400">RWA and crypto values move independently on their own update cadence.</p>
                <div className="mt-6 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={graphData}>
                      <defs>
                        {marketTokens.map((token) => {
                          const fillColor = getAreaFill(token.currentPrice, token.openingPrice);
                          const fillId = `fill-${token.name}`;
                          return (
                            <linearGradient key={fillId} id={fillId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={fillColor} stopOpacity={0.1} />
                              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} fontSize={12} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 10 }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      {marketTokens.map((token) => {
                        const lineColor = getLineColor(token.currentPrice, token.openingPrice);
                        const fillId = `fill-${token.name}`;
                        return (
                          <Area
                            key={`area-${token.name}`}
                            type="linear"
                            dataKey={token.name}
                            fill={`url(#${fillId})`}
                            stroke="none"
                            isAnimationActive={false}
                          />
                        );
                      })}
                      {marketTokens.map((token) => {
                        const lineColor = getLineColor(token.currentPrice, token.openingPrice);
                        return (
                          <Line
                            key={token.name}
                            type="linear"
                            dataKey={token.name}
                            stroke={lineColor}
                            strokeWidth={1}
                            dot={false}
                            activeDot={false}
                            isAnimationActive={false}
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
                <h2 className="text-xl font-semibold text-white">Live Trade Feed</h2>
                <div className="mt-4 space-y-3 h-[460px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {trades.map((trade) => (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.25 }}
                        className={`rounded-3xl border p-4 shadow-sm ${trade.type === 'buy' ? 'bg-emerald-950/40 border-emerald-500/30' : 'bg-rose-950/40 border-rose-500/25'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-white">{trade.asset}</p>
                            <p className="text-sm text-slate-400">{trade.quantity} units</p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${trade.type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.type.toUpperCase()}</p>
                            <p className="text-xs text-slate-500">{trade.timestamp.toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                          <span>Price</span>
                          <span>${trade.price.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-lg">
              <div className="flex flex-col gap-3 border-b border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Market Table</h2>
                  <p className="text-sm text-slate-400">Realtime token metrics and token status.</p>
                </div>
                <div className="space-y-1 text-right text-sm text-slate-400">
                  <div>Updated every interval</div>
                  <div>{tokensLoading ? 'Loading RWA tokens…' : !rwaTokens.length ? 'Only SOL and USDC available' : `${rwaTokens.length} RWA tokens loaded`}</div>
                </div>
              </div>
              <div className="min-w-full overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="px-6 py-4">Token Name</th>
                      <th className="px-6 py-4">Current Price</th>
                      <th className="px-6 py-4">24h Change</th>
                      <th className="px-6 py-4">Volume</th>
                      <th className="px-6 py-4">Holders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketTokens.map((token) => (
                      <tr key={token.name} className="border-b border-slate-800">
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white inline-flex items-center gap-2">
                              {token.name}
                              {token.name === 'SOL' && (
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                              )}
                            </span>
                            <AnimatePresence>
                              {token.isNew ? (
                                <motion.span
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300"
                                >
                                  New
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-100">${token.currentPrice.toFixed(2)}</td>
                        <td className={`px-6 py-4 ${token.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-slate-300">{token.volume.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-300">{token.holders.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="lg:col-span-4 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-white">Agent Snapshot</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Active AI</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{selectedAgent.name}</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl" style={{ backgroundColor: selectedAgent.color }} />
                </div>
                <p className="mt-4 text-sm text-slate-400">{selectedAgent.description}</p>
              </div>


              <div className="rounded-3xl bg-slate-950/80 p-5">
                <div className="flex justify-between text-sm text-slate-400 mb-3">
                  <span>Confidence</span>
                  <span className="text-slate-100">{Math.round(agentConfidence)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800 mb-4">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${agentConfidence}%`, backgroundColor: selectedAgent.color }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {agentThinking ? (
                  <p className="text-sm text-slate-400">⟳ Analyzing market...</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">{lastAgentReasoning || 'Awaiting first cycle...'}</p>
                )}
              </div>

              <div className="rounded-3xl bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500 mb-4">Agent Control</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setAgentRunning(!agentRunning)}
                    className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
                      agentRunning
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {agentRunning ? '■ STOP AGENT' : '▶ RUN AGENT'}
                  </button>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${agentRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-slate-300">{agentRunning ? '● LIVE' : '○ IDLE'}</span>
                  </div>
                </div>
              </div>

            {/* AI Reasoning Console */}
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">AI Reasoning Console</h2>
                  {agentRunning && (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
              </div>
              {reasoningLog.length === 0 ? (
                <div className="flex items-center justify-center h-24">
                  {agentRunning ? (
                    <p className="text-slate-400 text-sm animate-pulse">Waiting for first decision...</p>
                  ) : (
                    <p className="text-slate-500 text-sm">Start the agent to see AI reasoning here</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 h-[300px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {reasoningLog.map((entry, i) => (
                      <motion.div
                        key={`${entry.timestamp}-${i}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25 }}
                        className="rounded-2xl border border-slate-700/50 bg-slate-950/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-500">{entry.timestamp}</span>
                            <span className="text-xs font-semibold" style={{ color: AGENTS.find(a => a.name === entry.agentName)?.color || '#94a3b8' }}>
                              {entry.agentName}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              entry.action === 'buy' ? 'bg-emerald-500/20 text-emerald-400' :
                              entry.action === 'sell' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {entry.action.toUpperCase()}
                            </span>
                            <span className="text-sm text-white">{entry.token}</span>
                            {entry.action !== 'hold' && (
                              <span className="text-xs text-cyan-400">{entry.amount}</span>
                            )}
                          </div>
                          <span className="text-xs text-yellow-400">{Math.round(entry.confidence)}%</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-400 font-mono leading-relaxed">{entry.reasoning}</p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

              <div className="rounded-3xl bg-slate-950/80 p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-500 mb-4">Portfolio</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Cash Balance</span>
                    <span className="text-white">${portfolio.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>Holdings Value</span>
                    <span className="text-white">${(portfolio.totalValue - portfolio.cashBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-3 flex justify-between text-sm font-semibold text-slate-100">
                    <span>Total Value</span>
                    <span>${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {Object.keys(portfolio.holdings).length > 0 && (
                    <div className="border-t border-slate-700 pt-3 space-y-2">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-500 font-semibold">Current Holdings</p>
                      {Object.entries(portfolio.holdings).map(([tokenName, holding]) => (
                        <div key={tokenName} className="flex justify-between text-xs text-slate-400">
                          <span>{tokenName}</span>
                          <span>{holding.shares.toFixed(2)} shares</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}