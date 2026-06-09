'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, Copy, CheckCircle2, Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, Users, Lock } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BASE_SCAN = 'https://basescan.org';

interface BondingParams {
  startMarketCap: number;
  endMarketCap: number;
  totalSupply: number;
  sold: number;
  creatorFee: number;
  creator: string;
}

interface TokenDetail {
  name: string;
  symbol: string;
  supply: string;
  deployer: string;
  contract_address: string;
  tx_hash: string;
  block_number: number;
  created_at: number;
  description?: string;
  logo?: string;
  bonding?: BondingParams;
}

function BondingCurveChart({ params, width = 400, height = 200 }: { params: BondingParams; width?: number; height?: number }) {
  const { startMarketCap, endMarketCap, totalSupply, sold } = params;

  const slope = (endMarketCap - startMarketCap) / totalSupply;
  const currentPrice = startMarketCap + sold * slope;
  const maxSold = totalSupply;

  // Generate curve points
  const points: [number, number][] = [];
  const steps = 50;
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * maxSold;
    const price = startMarketCap + s * slope;
    const mcap = price * s;
    points.push([i / steps, mcap / endMarketCap]);
  }

  // Current position
  const currentX = sold / maxSold;
  const currentY = currentPrice * sold / endMarketCap;

  const pathD = points.map((p, i) =>
    i === 0 ? `M ${p[0] * width} ${height - p[1] * height}` : `L ${p[0] * width} ${height - p[1] * height}`
  ).join(' ');

  // Area under curve up to current point
  const areaPath = pathD + ` L ${currentX * width} ${height} L 0 ${height} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="curve-chart">
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line
            x1="0" y1={height - v * height}
            x2={width} y2={height - v * height}
            stroke="#1a1a1a" strokeWidth="1"
          />
          <text x={5} y={height - v * height - 4} fill="#444" fontSize="9">{`${(v * 100).toFixed(0)}%`}</text>
        </g>
      ))}

      {/* Area fill */}
      <path
        d={areaPath}
        fill="url(#curveGrad)"
      />

      {/* Curve line */}
      <path
        d={pathD}
        fill="none"
        stroke="#FF6B00"
        strokeWidth="2"
      />

      {/* Current position dot */}
      <circle
        cx={currentX * width}
        cy={height - (currentPrice * sold / endMarketCap)}
        r="5"
        fill="#FF6B00"
        stroke="#0a0a0a"
        strokeWidth="2"
      />

      {/* X-axis label */}
      <text x={width / 2} y={height + 16} fill="#555" fontSize="10" textAnchor="middle">% Supply Sold</text>

      {/* Y-axis label */}
      <text x={-height / 2} y={-30} fill="#555" fontSize="10" textAnchor="middle" transform={`rotate(-90)`}>Market Cap</text>
    </svg>
  );
}

export default function TokenPage() {
  const params = useParams();
  const address = params.address as string;

  const [token, setToken] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [sellLoading, setSellLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tokens/${address}`);
      if (!res.ok) throw new Error('Token not found');
      const data = await res.json();
      setToken(data.token || data);
    } catch {
      setError('Token not found or network error');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBuy = async () => {
    if (!buyAmount || isNaN(parseFloat(buyAmount))) return;
    setBuyLoading(true);
    setTxStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/tokens/${address}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: buyAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Buy failed');
      setTxStatus({ type: 'success', msg: `Bought ${buyAmount} tokens! Tx: ${data.txHash?.slice(0, 10)}...` });
      setBuyAmount('');
      fetchToken();
    } catch (err) {
      setTxStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Buy failed' });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleSell = async () => {
    if (!sellAmount || isNaN(parseFloat(sellAmount))) return;
    setSellLoading(true);
    setTxStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/tokens/${address}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: sellAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sell failed');
      setTxStatus({ type: 'success', msg: `Sold ${sellAmount} tokens! Tx: ${data.txHash?.slice(0, 10)}...` });
      setSellAmount('');
      fetchToken();
    } catch (err) {
      setTxStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Sell failed' });
    } finally {
      setSellLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-base" />
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{error || 'Token not found'}</p>
        <Link href="/" className="text-base hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const bp = token.bonding;
  const sold = bp?.sold ?? 0;
  const totalSupply = bp?.totalSupply ? parseFloat(bp.totalSupply.toString()) : parseFloat(token.supply);
  const soldPct = totalSupply > 0 ? (sold / totalSupply) * 100 : 0;
  const slope = bp ? (bp.endMarketCap - bp.startMarketCap) / totalSupply : 0;
  const currentPrice = bp ? bp.startMarketCap + sold * slope : 0;

  return (
    <div className="min-h-screen bg-dark">
      {/* Minimal Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-2">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-white font-bold text-lg">Base<span className="text-base">Kit</span></span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Token Header */}
          <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              {token.logo ? (
                <img src={token.logo} alt={token.name} className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xl">{token.symbol.slice(0, 2)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{token.name}</h1>
                <p className="text-gray-400 text-sm font-mono">{token.symbol}</p>
                {token.description && (
                  <p className="text-gray-300 text-sm mt-2">{token.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(token.contract_address, 'address')}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-2 transition-colors"
                >
                  {copied === 'address' ? <CheckCircle2 size={16} className="text-success" /> : <Copy size={16} />}
                </button>
                <a
                  href={`${BASE_SCAN}/address/${token.contract_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-2 transition-colors"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            {/* Stats row */}
            {bp && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-dark rounded-xl p-3">
                  <p className="text-xs text-gray-500">Current Price</p>
                  <p className="text-sm font-mono font-medium text-white mt-0.5">
                    ${currentPrice.toFixed(6)}
                  </p>
                </div>
                <div className="bg-dark rounded-xl p-3">
                  <p className="text-xs text-gray-500">Market Cap</p>
                  <p className="text-sm font-mono font-medium text-white mt-0.5">
                    ${(currentPrice * sold).toFixed(2)}
                  </p>
                </div>
                <div className="bg-dark rounded-xl p-3">
                  <p className="text-xs text-gray-500">Sold</p>
                  <p className="text-sm font-mono font-medium text-white mt-0.5">
                    {soldPct.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-dark rounded-xl p-3">
                  <p className="text-xs text-gray-500">Creator Fee</p>
                  <p className="text-sm font-mono font-medium text-white mt-0.5">
                    {((bp.creatorFee ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bonding Curve */}
          {bp ? (
            <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp size={18} className="text-base" />
                  Bonding Curve
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Live
                </div>
              </div>

              <div className="bg-dark rounded-xl p-4 mb-4">
                <BondingCurveChart params={bp} width={500} height={200} />
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{soldPct.toFixed(1)}% sold</span>
                  <span>${bp.startMarketCap.toLocaleString()} → ${bp.endMarketCap.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-dark-3 rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-accent transition-all duration-500"
                    style={{ width: `${Math.min(soldPct, 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Price rises linearly as tokens are purchased. No presales, fair launch for everyone.
              </p>
            </div>
          ) : (
            <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">Bonding curve data not available (demo mode)</p>
            </div>
          )}

          {/* Buy / Sell */}
          {bp ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Buy */}
              <div className="bg-dark-1 border border-dark-2 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowUpRight size={18} className="text-success" />
                  <h3 className="font-semibold">Buy Tokens</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount (tokens)</label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full px-3 py-2.5 bg-dark border border-dark-2 rounded-xl text-white text-sm placeholder-gray-600 focus:border-base"
                    />
                  </div>
                  {buyAmount && !isNaN(parseFloat(buyAmount)) && currentPrice > 0 && (
                    <p className="text-xs text-gray-400">
                      Estimated cost: <span className="text-white font-mono">${(parseFloat(buyAmount) * currentPrice).toFixed(6)} ETH</span>
                    </p>
                  )}
                  <button
                    onClick={handleBuy}
                    disabled={!buyAmount || buyLoading}
                    className="btn-primary w-full py-3 bg-success text-dark font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {buyLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    {buyLoading ? 'Processing...' : 'Buy'}
                  </button>
                </div>
              </div>

              {/* Sell */}
              <div className="bg-dark-1 border border-dark-2 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowDownRight size={18} className="text-error" />
                  <h3 className="font-semibold">Sell Tokens</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount (tokens)</label>
                    <input
                      type="number"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      placeholder="1000"
                      className="w-full px-3 py-2.5 bg-dark border border-dark-2 rounded-xl text-white text-sm placeholder-gray-600 focus:border-base"
                    />
                  </div>
                  {sellAmount && !isNaN(parseFloat(sellAmount)) && currentPrice > 0 && (
                    <p className="text-xs text-gray-400">
                      Estimated return: <span className="text-white font-mono">${(parseFloat(sellAmount) * currentPrice * 0.994).toFixed(6)} ETH</span>
                      <span className="text-gray-500"> (0.5% platform fee)</span>
                    </p>
                  )}
                  <button
                    onClick={handleSell}
                    disabled={!sellAmount || sellLoading}
                    className="btn-primary w-full py-3 bg-error text-white font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sellLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    {sellLoading ? 'Processing...' : 'Sell'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6 text-center">
              <p className="text-gray-400 text-sm">Buy/Sell available when connected to backend</p>
            </div>
          )}

          {/* Transaction status */}
          {txStatus && (
            <div className={`p-4 rounded-xl text-sm ${txStatus.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'}`}>
              {txStatus.msg}
            </div>
          )}

          {/* Details */}
          <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lock size={16} className="text-gray-400" />
              Token Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Contract</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{token.contract_address.slice(0, 10)}...{token.contract_address.slice(-6)}</span>
                  <button onClick={() => copyToClipboard(token.contract_address, 'ca')} className="text-gray-500 hover:text-white">
                    {copied === 'ca' ? <CheckCircle2 size={10} className="text-success" /> : <Copy size={10} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Supply</span>
                <span className="font-mono">{parseFloat(token.supply).toLocaleString()} {token.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Deployer</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{token.deployer.slice(0, 8)}...{token.deployer.slice(-6)}</span>
                  <a href={`${BASE_SCAN}/address/${token.deployer}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white">
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Transaction</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs">{token.tx_hash.slice(0, 10)}...</span>
                  <a href={`${BASE_SCAN}/tx/${token.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white">
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              {bp && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Creator</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{bp.creator.slice(0, 8)}...{bp.creator.slice(-6)}</span>
                      <a href={`${BASE_SCAN}/address/${bp.creator}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white">
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Curve Start</span>
                    <span className="font-mono">${bp.startMarketCap.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Curve End</span>
                    <span className="font-mono">${bp.endMarketCap.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fee info */}
          {bp && (
            <div className="flex items-center gap-2 text-xs text-gray-500 justify-center">
              <Users size={12} />
              <span>0.5% platform fee · {((bp.creatorFee ?? 0) * 100).toFixed(1)}% creator fee on each trade</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
