'use client';

import { useState, useRef, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink, Wallet, Zap, Upload, Image } from 'lucide-react';

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

  // Basic fields
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [description, setDescription] = useState('');

  // Bonding curve fields
  const [startMc, setStartMc] = useState('200');
  const [endMc, setEndMc] = useState('50000');
  const [creatorFee, setCreatorFee] = useState('5');

  // Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<DeployStatus>('idle');
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = ev.target?.result as string;
      setLogoPreview(preview);
      setLogoUrl(preview);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = ev.target?.result as string;
      setLogoPreview(preview);
      setLogoUrl(preview);
    };
    reader.readAsDataURL(file);
  }, []);

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
    const startMcNum = parseFloat(startMc);
    const endMcNum = parseFloat(endMc);
    if (isNaN(startMcNum) || startMcNum < 10 || startMcNum > 1e6) {
      setError('Start market cap must be between $10 and $1M');
      setStatus('error');
      return;
    }
    if (isNaN(endMcNum) || endMcNum <= startMcNum || endMcNum > 1e9) {
      setError('End market cap must be greater than start cap, max $1B');
      setStatus('error');
      return;
    }
    const feeNum = parseFloat(creatorFee);
    if (isNaN(feeNum) || feeNum < 0 || feeNum > 10) {
      setError('Creator fee must be between 0% and 10%');
      setStatus('error');
      return;
    }

    setStatus('deploying');
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        supply,
        deployer: address,
        description: description.trim() || undefined,
        startMarketCap: startMcNum,
        endMarketCap: endMcNum,
        creatorFee: feeNum / 100,
      };

      // Include logo if available
      if (logoUrl) {
        payload.logo = logoUrl;
      }

      const res = await fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        setStartMc('200');
        setEndMc('50000');
        setCreatorFee('5');
        setLogoUrl(null);
        setLogoFile(null);
        setLogoPreview(null);
      }, 3000);
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

  const isFormValid = isConnected && name && symbol && supply && !isNaN(parseFloat(startMc)) && !isNaN(parseFloat(endMc));

  return (
    <section id="launch" className="py-16 px-4">
      <div className="max-w-lg mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Launch Your Token</h2>
          <p className="text-gray-400 text-sm">Deploy with a bonding curve — fair launch, no presales</p>
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

          {/* Logo Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1.5">
              Token Logo <span className="text-gray-500">(optional)</span>
            </label>
            <div
              className={`logo-upload rounded-xl p-4 flex flex-col items-center justify-center gap-2 ${logoPreview ? '' : 'min-h-[100px]'}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Token logo" className="w-16 h-16 rounded-full object-cover" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-dark-2 rounded-full flex items-center justify-center">
                    <Upload size={10} className="text-gray-400" />
                  </div>
                </div>
              ) : (
                <>
                  <Image size={24} className="text-gray-500" />
                  <p className="text-xs text-gray-500">Click or drag to upload logo</p>
                  <p className="text-xs text-gray-600">PNG, JPG, WebP — max 2MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
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
                Total Supply <span className="text-error">*</span>
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
                rows={2}
                disabled={!isConnected || status === 'deploying'}
                className="w-full px-4 py-3 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors resize-none disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/280</p>
            </div>

            {/* Bonding Curve Section */}
            <div className="border-t border-dark-2 pt-4 mt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap size={14} className="text-base" />
                Bonding Curve Settings
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Start Market Cap */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Start Market Cap <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={startMc}
                      onChange={(e) => setStartMc(e.target.value)}
                      placeholder="200"
                      min="10"
                      max="1000000"
                      disabled={!isConnected || status === 'deploying'}
                      className="w-full pl-6 pr-3 py-2.5 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors disabled:opacity-50 text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">Initial price floor</p>
                </div>

                {/* End Market Cap */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    End Market Cap <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={endMc}
                      onChange={(e) => setEndMc(e.target.value)}
                      placeholder="50000"
                      min="100"
                      max="1000000000"
                      disabled={!isConnected || status === 'deploying'}
                      className="w-full pl-6 pr-3 py-2.5 bg-dark border border-dark-2 rounded-xl text-white placeholder-gray-600 focus:border-base transition-colors disabled:opacity-50 text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">Fully diluted cap</p>
                </div>
              </div>

              {/* Creator Fee */}
              <div className="mt-3">
                <label className="block text-xs text-gray-400 mb-1">
                  Creator Fee: <span className="text-base font-medium">{creatorFee}%</span>
                </label>
                <input
                  type="range"
                  value={creatorFee}
                  onChange={(e) => setCreatorFee(e.target.value)}
                  min="0"
                  max="10"
                  step="0.5"
                  disabled={!isConnected || status === 'deploying'}
                  className="w-full disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>0%</span>
                  <span>5%</span>
                  <span>10%</span>
                </div>
              </div>

              {/* Curve preview summary */}
              {isConnected && !isNaN(parseFloat(startMc)) && !isNaN(parseFloat(endMc)) && parseFloat(supply) > 0 && (
                <div className="mt-3 p-3 bg-dark rounded-lg border border-dark-2">
                  <p className="text-xs text-gray-400 mb-1">Curve Summary</p>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Initial price:</span>{' '}
                      <span className="text-white font-mono">${(parseFloat(startMc) / parseFloat(supply)).toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max price:</span>{' '}
                      <span className="text-white font-mono">${(parseFloat(endMc) / parseFloat(supply)).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}
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
            disabled={!isFormValid || status === 'deploying'}
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
