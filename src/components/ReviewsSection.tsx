import type React from 'react';
import TestimonialCard from '@/components/TestimonialCard';
import { GOOGLE_RATING, GOOGLE_REVIEWS_URL, reviewsFor } from '@/data/googleReviews';

interface ReviewsSectionProps {
  page: string;
  title?: string;
  /** Use the shorter excerpt when a review has one. */
  short?: boolean;
  variant?: 'dark' | 'light' | 'gold';
  className?: string;
  /** Review ids to leave out on this page (they stay in the data). */
  exclude?: string[];
  /** Extra content shown under the rating line, e.g. experience stats. */
  children?: React.ReactNode;
}

/** Real Google reviews for a page, plus a link to all reviews on Google. */
export default function ReviewsSection({
  page,
  title,
  short = false,
  variant = 'light',
  className = '',
  exclude = [],
  children,
}: ReviewsSectionProps) {
  const reviews = reviewsFor(page).filter((review) => !exclude.includes(review.id));
  if (reviews.length === 0) return null;
  const onDark = variant === 'gold' || variant === 'dark';
  const cols = reviews.length === 1 ? 'max-w-3xl' : reviews.length === 2 ? 'md:grid-cols-2 max-w-4xl' : 'md:grid-cols-2 lg:grid-cols-3 max-w-6xl';

  return (
    <div className={className}>
      {title && (
        <h2 className={`text-3xl md:text-4xl font-semibold mb-3 text-center ${onDark ? 'text-cream-bright' : 'text-ink'}`}>
          {title}
        </h2>
      )}
      <p className={`text-center mb-8 ${onDark ? 'text-cream-muted' : 'text-ink-body'}`}>
        <span className={onDark ? 'text-gold' : 'text-gold-deep'} aria-hidden="true">★</span> {GOOGLE_RATING.value} from {GOOGLE_RATING.count} Google reviews
      </p>
      {children}
      <div className={`grid grid-cols-1 gap-6 mx-auto ${cols}`}>
        {reviews.map((review) => (
          <TestimonialCard
            key={review.id}
            quote={short && review.shortQuote ? review.shortQuote : review.quote}
            author={review.author}
            event={review.event}
            variant={variant}
          />
        ))}
      </div>
      <p className="text-center mt-8">
        <a
          href={GOOGLE_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-semibold underline underline-offset-2 ${onDark ? 'text-gold-bright hover:text-cream-bright' : 'text-gold-deep hover:text-gold-deeper'}`}
        >
          Read all reviews on Google<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
