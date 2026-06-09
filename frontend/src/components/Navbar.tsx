'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { RotateCw, Wallet } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-2">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-base flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Base<span className="text-base">Kit</span>
          </span>
        </a>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-dark-2 border border-dark-3 rounded-lg hover:border-base transition-colors"
              >
                <Wallet size={16} className="text-base" />
                <span className="font-mono text-sm">{truncatedAddress}</span>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-dark-1 border border-dark-2 rounded-lg shadow-xl py-1">
                  <div className="px-3 py-2 border-b border-dark-2">
                    <p className="text-xs text-gray-400">Connected</p>
                    <p className="font-mono text-sm truncate">{address}</p>
                  </div>
                  <button
                    onClick={() => { disconnect(); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-dark-2 text-error"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => {
                const injected = connectors.find(c => c.id === 'injected');
                if (injected) connect({ connector: injected });
              }}
              disabled={isConnecting || isPending}
              className="flex items-center gap-2 px-4 py-2 bg-base text-white rounded-lg font-medium text-sm hover:bg-base-dark transition-colors disabled:opacity-50"
            >
              {isConnecting || isPending ? (
                <RotateCw size={16} className="animate-spin" />
              ) : (
                <Wallet size={16} />
              )}
              {isConnecting || isPending ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
