import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  event?: string;
  location?: string;
  /** "dark" for the blue home sections, "light" for white/gray sections. */
  variant?: 'dark' | 'light';
}

export default function TestimonialCard({
  quote,
  author,
  event,
  location,
  variant = 'dark',
}: TestimonialCardProps) {
  const light = variant === 'light';
  return (
    <figure
      className={
        light
          ? 'h-full flex flex-col bg-white rounded-2xl p-6 md:p-8 shadow-md border border-gray-200'
          : 'h-full flex flex-col bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-3xl p-8 shadow-[0_0_25px_rgba(0,174,239,0.3)] border-2 border-blue-500/30 backdrop-blur-sm hover:shadow-[0_0_35px_rgba(0,174,239,0.5)] transition-all'
      }
    >
      <Quote
        aria-hidden="true"
        className={light ? 'w-8 h-8 text-amber-600 mb-3' : 'w-10 h-10 text-blue-400 mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.6)]'}
      />
      <blockquote className={`flex-1 mb-6 italic ${light ? 'text-gray-800 text-base' : 'text-blue-100 text-lg'}`}>
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className={`border-t pt-4 ${light ? 'border-gray-200' : 'border-blue-500/30'}`}>
        <p className={`font-semibold ${light ? 'text-gray-900' : 'text-blue-50'}`}>{author}</p>
        <p className={`text-sm ${light ? 'text-gray-700' : 'text-blue-200'}`}>
          <span className="text-amber-500" aria-label="5 out of 5 stars">★★★★★</span> Google review
          {event && ` • ${event}`}
          {location && ` • ${location}`}
        </p>
      </figcaption>
    </figure>
  );
}
