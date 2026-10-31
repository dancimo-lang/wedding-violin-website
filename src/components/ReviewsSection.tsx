import TestimonialCard from '@/components/TestimonialCard';
import { GOOGLE_RATING, GOOGLE_REVIEWS_URL, reviewsFor } from '@/data/googleReviews';

interface ReviewsSectionProps {
  page: string;
  title?: string;
  /** Use the shorter excerpt when a review has one. */
  short?: boolean;
  variant?: 'dark' | 'light';
  className?: string;
}

/** Real Google reviews for a page, plus a link to all reviews on Google. */
export default function ReviewsSection({
  page,
  title,
  short = false,
  variant = 'light',
  className = '',
}: ReviewsSectionProps) {
  const reviews = reviewsFor(page);
  if (reviews.length === 0) return null;
  const light = variant === 'light';
  const cols = reviews.length === 1 ? 'max-w-3xl' : reviews.length === 2 ? 'md:grid-cols-2 max-w-4xl' : 'md:grid-cols-2 lg:grid-cols-3 max-w-6xl';

  return (
    <div className={className}>
      {title && (
        <h2 className={`text-3xl font-bold mb-3 text-center ${light ? 'text-gray-900' : 'text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]'}`}>
          {title}
        </h2>
      )}
      <p className={`text-center mb-8 ${light ? 'text-gray-700' : 'text-white/90'}`}>
        <span className="text-amber-500" aria-hidden="true">★</span> {GOOGLE_RATING.value} from {GOOGLE_RATING.count} Google reviews
      </p>
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
          className={`font-semibold underline underline-offset-2 ${light ? 'text-amber-800 hover:text-amber-900' : 'text-amber-200 hover:text-white'}`}
        >
          Read all reviews on Google<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}
