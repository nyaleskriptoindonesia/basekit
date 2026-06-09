'use client';

import { Zap, Shield, Globe } from 'lucide-react';

export default function Hero() {
  return (
    <section className="pt-32 pb-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-dark-2 border border-dark-3 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-gray-400">Live on Base Mainnet</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 animate-fade-in">
          Launch your token on{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-base to-blue-400">
            Base
          </span>{' '}
          <br />in 60 seconds
        </h1>

        {/* Subtext */}
        <p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
          No coding required. Deploy your own ERC-20 token on Base network with just a few clicks. Fast, cheap, and secure.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <a
            href="#launch"
            className="btn-primary px-8 py-3 bg-base text-white rounded-xl font-semibold text-base"
          >
            Launch Your Token
          </a>
          <a
            href="#recent"
            className="px-8 py-3 bg-dark-2 text-gray-300 rounded-xl font-medium text-base border border-dark-3 hover:border-dark-3 hover:bg-dark-3 transition-colors"
          >
            View Recent Tokens
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-16 max-w-lg mx-auto animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-white">
              <Zap size={20} className="text-base" />
              <span>&lt;5s</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Deploy Time</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-white">
              <Shield size={20} className="text-success" />
              <span>100%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Decentralized</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-white">
              <Globe size={20} className="text-accent" />
              <span>Base</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Network</p>
          </div>
        </div>
      </div>
    </section>
  );
}
