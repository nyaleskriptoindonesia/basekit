'use client';

import { Wallet, FileText, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Wallet,
    title: 'Connect Your Wallet',
    description: 'Link your MetaMask or WalletConnect wallet to Base network. Make sure you have some BASE tokens for gas.',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Fill in Token Details',
    description: 'Enter your token name, symbol, and initial supply. Add an optional description for your token.',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Deploy & Launch',
    description: 'Sign the transaction and your ERC-20 token will be deployed on Base. Your token is live instantly.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2">How It Works</h2>
          <p className="text-gray-400 text-sm">Three simple steps to launch your token</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-dark-1 border border-dark-2 rounded-2xl p-6 relative overflow-hidden"
            >
              {/* Background number */}
              <span className="absolute top-2 right-4 text-6xl font-extrabold text-dark-2 select-none">
                {step.number}
              </span>

              {/* Icon */}
              <div className="relative z-10 w-12 h-12 rounded-xl bg-base/10 border border-base/20 flex items-center justify-center mb-4">
                <step.icon size={22} className="text-base" />
              </div>

              {/* Content */}
              <h3 className="relative z-10 text-base font-semibold mb-2">{step.title}</h3>
              <p className="relative z-10 text-sm text-gray-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
