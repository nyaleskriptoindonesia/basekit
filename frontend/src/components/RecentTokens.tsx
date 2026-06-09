'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Copy, RefreshCw, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Token {
  id: number;
  name: string;
  symbol: string;
  supply: string;
  deployer: string;
  contract_address: string;
  tx_hash: string;
  block_number: number;
  created_at: number;
  description?: string;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSupply(supply: string): string {
  const num = parseFloat(supply);
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

export default function RecentTokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tokens?limit=10`);
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch {
      // Silently fail - demo mode
      setTokens([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section id="recent" className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Recent Tokens</h2>
            <p className="text-sm text-gray-400 mt-1">Latest deployments on BaseKit</p>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchTokens(); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-dark-1 border border-dark-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-dark-1 border border-dark-2 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-500" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-dark-2 flex items-center justify-center mb-3">
                <span className="text-2xl">📭</span>
              </div>
              <p className="text-gray-400">No tokens deployed yet</p>
              <p className="text-sm text-gray-500 mt-1">Be the first to launch your token!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-2">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Token</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden md:table-cell">Supply</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 hidden sm:table-cell">Deployer</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Time</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, i) => (
                    <tr key={token.id} className={`table-row ${i !== tokens.length - 1 ? 'border-b border-dark-2' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-sm">{token.name}</p>
                          <p className="text-xs text-gray-400">{token.symbol}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm font-mono">{formatSupply(token.supply)}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs text-gray-400">
                            {token.deployer.slice(0, 6)}...{token.deployer.slice(-4)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(token.deployer, `deployer-${token.id}`)}
                            className="text-gray-600 hover:text-gray-300"
                          >
                            {copied === `deployer-${token.id}` ? '✓' : <Copy size={10} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{timeAgo(token.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`https://basescan.org/tx/${token.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-base hover:text-blue-400"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
