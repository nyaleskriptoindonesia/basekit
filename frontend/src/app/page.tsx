'use client';

import { Providers } from './providers';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import LaunchForm from '@/components/LaunchForm';
import RecentTokens from '@/components/RecentTokens';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <Providers>
      <div className="min-h-screen bg-dark">
        <Navbar />
        <main>
          <Hero />
          <LaunchForm />
          <RecentTokens />
          <HowItWorks />
        </main>
        <Footer />
      </div>
    </Providers>
  );
}
