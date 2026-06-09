'use client';

import { Github, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-dark-2 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-base flex items-center justify-center">
              <span className="text-white font-bold text-xs">B</span>
            </div>
            <span className="text-sm font-medium">BaseKit</span>
            <span className="text-gray-600">·</span>
            <span className="text-xs text-gray-500">Powered by Base</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Orbitbox2026/basekit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github size={18} />
            </a>
            <a
              href="https://x.com/Orbitbox_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter size={18} />
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          BaseKit is a decentralized launchpad. Always DYOR before interacting with any token.
        </p>
      </div>
    </footer>
  );
}
