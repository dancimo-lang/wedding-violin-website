'use client';

import { Music } from 'lucide-react';
import { btnGold } from '@/lib/theme';

export default function ListenButton() {
  const scrollToSampler = () => {
    document.getElementById('wedding-sampler')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="text-center py-8">
      <button
        onClick={scrollToSampler}
        className={`gap-2 ${btnGold}`}
      >
        <Music className="w-5 h-5" />
        Listen
      </button>
    </div>
  );
}
