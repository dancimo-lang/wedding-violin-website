import site from './site.json';
import testimonials from './testimonials.json';

/** Opens the reviews panel of Daniel's Google Business Profile. */
export const GOOGLE_REVIEWS_URL =
  'https://www.google.com/search?kgmid=/g/11n3bltyhl&q=Daniel+Cimo+%E2%80%93+Wedding+Violinist#mpd=~1637803179330104696/customers/reviews';

/** Owner's Google Business Profile share link (footer). */
export const GOOGLE_PROFILE_URL = site.social.google;

/** Google rating as shown on the profile. Update when new reviews arrive. */
export const GOOGLE_RATING = { value: '5.0', count: 9 };

export type Review = {
  id: string;
  quote: string;
  shortQuote?: string;
  author: string;
  event?: string;
  pages: string[];
};

export function reviewsFor(page: string): Review[] {
  return (testimonials.testimonials as Review[]).filter((review) => review.pages.includes(page));
}
