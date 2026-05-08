'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Notifications from '@/components/Notifications';

const GenogramCanvas = dynamic(
  () => import('@/components/genogram/Canvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <div className="text-gray-500 text-lg">Loading genogram...</div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="w-full h-screen">
      <ErrorBoundary>
        <GenogramCanvas />
      </ErrorBoundary>
      <Notifications />
    </main>
  );
}
