'use client';

import { Music } from 'lucide-react';

export default function ListenButton() {
  const scrollToSampler = () => {
    document.getElementById('wedding-sampler')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="text-center py-8">
      <button
        onClick={scrollToSampler}
        className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-full font-semibold transition-colors shadow-lg"
      >
        <Music className="w-5 h-5" />
        Listen
      </button>
    </div>
  );
}
