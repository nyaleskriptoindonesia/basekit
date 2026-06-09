'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink, Wallet, Zap } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type DeployStatus = 'idle' | 'deploying' | 'success' | 'error';

interface DeployResult {
  txHash: string;
  contractAddress: string;
  blockNumber: number;
  demo?: boolean;
}

export default function LaunchForm() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DeployStatus>('idle');
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  const handleDeploy = async () => {
    if (!address) return;

    // Validation
    if (!name.trim() || name.length < 2 || name.length > 50) {
      setError('Token name must be 2-50 characters');
      setStatus('error');
      return;
    }
    if (!symbol.trim() || symbol.length < 2 || symbol.length > 8) {
      setError('Token symbol must be 2-8 characters');
      setStatus('error');
      return;
    }
    if (!supply || isNaN(Number(supply)) || Number(supply) <= 0 || Number(supply) > 1e12) {
      setError('Supply must be between 1 and 1 trillion');
      setStatus('error');
      return;
    }

    setStatus('deploying');
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          symbol: symbol.trim().toUpperCase(),
          supply,
          deployer: address,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setResult({
        txHash: data.txHash,
        contractAddress: data.contractAddress,
        blockNumber: data.blockNumber,
        demo: data.demo,
      });
      setStatus('success');

      // Reset form after success
      setTimeout(() => {
        setName('');
        setSymbol('');
        setSupply('');
        setDescription('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStatus('error');
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const connectWallet = () => {
    const injected = connectors.find(c => c.id === 'injected');
    if (injected) connect({ connector: injected });
  };

  return (
    <section id="launch" className="py-16 px-4">
      <div className="max-w-lg mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Launch Your Token</h2>
          <p className="text-gray-400 text-sm">Fill in the details below to deploy your ERC-20 token</p>
        </div>

        {/* Form Card */}
        <div className="bg-dark-1 border border-dark-2 rounded-2xl p-6">
          {/* Wallet Status */}
          <div className="mb-6 p-4 bg-dark rounded-xl border border-dark-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success' : 'bg-gray-500'}`} />
                <div>
                  <p className="text-sm font-medium">
                    {isConnected ? 'Wallet Connected' : 'Wallet Not Connected'}
                  </p>
                  {isConnected && (
                    <p className="font-mono text-xs text-gray-400">{truncatedAddress}</p>
                  )}
                </div>
              </div>
              {isConnected ? (
                <button
                  onClick={() => disconnect()}
                  className="text-xs text-error hover:underline"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={connectWallet}
                  className="flex items-center gap-1 text-xs text-base hover:underline"
                >
                  <Wallet size={12} /> Connect
                </button>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Token Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Token Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Token"
                maxLength={50}
                disabled={!isConnected || status === 'deploying'}
                className="w-full px-4 py-3 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">{name.length}/50</p>
            </div>

            {/* Token Symbol */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Token Symbol <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="MAT"
                maxLength={8}
                disabled={!isConnected || status === 'deploying'}
                className="w-full px-4 py-3 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors disabled:opacity-50 uppercase"
              />
            </div>

            {/* Initial Supply */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Initial Supply <span className="text-error">*</span>
              </label>
              <input
                type="number"
                value={supply}
                onChange={(e) => setSupply(e.target.value)}
                placeholder="1000000"
                min="1"
                max="1000000000000"
                disabled={!isConnected || status === 'deploying'}
                className="w-full px-4 py-3 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">Max supply: 1 trillion</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description <span className="text-gray-500">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your token..."
                maxLength={280}
                rows={3}
                disabled={!isConnected || status === 'deploying'}
                className="w-full px-4 py-3 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors resize-none disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/280</p>
            </div>
          </div>

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="mt-4 p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-error font-medium">Deployment Failed</p>
                <p className="text-xs text-error/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === 'success' && result && (
            <div className="mt-4 p-4 bg-success/10 border border-success/20 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-success" />
                <p className="text-sm text-success font-medium">Token Deployed Successfully!</p>
              </div>

              {result.demo && (
                <p className="text-xs text-accent bg-accent/10 px-2 py-1 rounded inline-block">
                  Demo Mode — Configure factory contract for mainnet
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Contract</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{result.contractAddress.slice(0, 10)}...{result.contractAddress.slice(-6)}</span>
                    <button onClick={() => copyToClipboard(result.contractAddress, 'contract')} className="text-gray-400 hover:text-white">
                      {copied === 'contract' ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                    <a
                      href={`https://basescan.org/address/${result.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Transaction</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs">{result.txHash.slice(0, 10)}...{result.txHash.slice(-6)}</span>
                    <button onClick={() => copyToClipboard(result.txHash, 'tx')} className="text-gray-400 hover:text-white">
                      {copied === 'tx' ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                    <a
                      href={`https://basescan.org/tx/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={!isConnected || status === 'deploying' || !name || !symbol || !supply}
            className="btn-primary w-full mt-6 py-4 bg-base text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'deploying' ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Deploying...
              </>
            ) : !isConnected ? (
              <>
                <Wallet size={18} />
                Connect Wallet to Deploy
              </>
            ) : (
              <>
                <Zap size={18} />
                Launch Token
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
