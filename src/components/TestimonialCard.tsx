import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  event?: string;
  location?: string;
}

export default function TestimonialCard({
  quote,
  author,
  event,
  location,
}: TestimonialCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-3xl p-8 shadow-[0_0_25px_rgba(0,174,239,0.3)] border-2 border-blue-500/30 backdrop-blur-sm hover:shadow-[0_0_35px_rgba(0,174,239,0.5)] transition-all">
      <Quote className="w-10 h-10 text-blue-400 mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.6)]" />
      <blockquote className="text-blue-100 text-lg mb-6 italic">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="border-t border-blue-500/30 pt-4">
        <p className="font-semibold text-blue-50">{author}</p>
        {(event || location) && (
          <p className="text-sm text-blue-300">
            {event}
            {event && location && ' • '}
            {location}
          </p>
        )}
      </div>
    </div>
  );
}
