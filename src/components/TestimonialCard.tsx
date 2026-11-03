import { Quote } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  event?: string;
  location?: string;
  /** "gold" or "dark" for charcoal sections, "light" for cream sections. */
  variant?: 'dark' | 'light' | 'gold';
}

export default function TestimonialCard({
  quote,
  author,
  event,
  location,
  variant = 'dark',
}: TestimonialCardProps) {
  const onDark = variant === 'gold' || variant === 'dark';
  return (
    <figure
      className={
        onDark
          ? 'h-full flex flex-col bg-charcoal-raised rounded-xl p-8 border border-gold/30'
          : 'h-full flex flex-col bg-cream-card rounded-xl p-6 md:p-8 border border-cream-line'
      }
    >
      <Quote
        aria-hidden="true"
        className={`w-8 h-8 mb-4 ${onDark ? 'text-gold' : 'text-gold-deep'}`}
      />
      <blockquote className={`flex-1 mb-6 italic leading-relaxed ${onDark ? 'text-cream-soft' : 'text-ink-body'}`}>
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className={`border-t pt-4 ${onDark ? 'border-gold/30' : 'border-cream-line'}`}>
        <p className={`font-semibold ${onDark ? 'text-cream-bright' : 'text-ink'}`}>{author}</p>
        <p className={`text-sm ${onDark ? 'text-cream-dim' : 'text-ink-soft'}`}>
          <span className={onDark ? 'text-gold' : 'text-gold-deep'} aria-label="5 out of 5 stars">★★★★★</span> Google review
          {event && ` • ${event}`}
          {location && ` • ${location}`}
        </p>
      </figcaption>
    </figure>
  );
}
