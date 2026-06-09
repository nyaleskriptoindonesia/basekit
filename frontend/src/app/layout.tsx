import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BaseKit — Launch Tokens on Base',
  description: 'Launch your ERC-20 token on Base network in 60 seconds. No coding required.',
  keywords: ['Base', 'token', 'launchpad', 'ERC-20', 'crypto', 'Base network'],
  openGraph: {
    title: 'BaseKit — Launch Tokens on Base',
    description: 'Launch your ERC-20 token on Base network in 60 seconds.',
    type: 'website',
    url: 'https://basekit.xyz',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BaseKit — Launch Tokens on Base',
    description: 'Launch your ERC-20 token on Base network in 60 seconds.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
