import { serifHeadings } from '@/lib/fonts';
import { Suspense } from 'react';
import Image from 'next/image';
import site from '@/data/site.json';
import { GOOGLE_REVIEWS_URL } from '@/data/googleReviews';
import { phoneSmsHref, phoneTelHref } from '@/lib/phone';
import BookingForm from './booking-form';
import ReviewsSection from '@/components/ReviewsSection';
import BookingPrefill from './booking-prefill';
import BookingHeading, { BookingHeadingText } from './booking-heading';

export default function BookingPage() {
  return (
    <>
      {/* Hero */}
      <section id="plan-proposal" className={`scroll-mt-20 relative py-6 md:py-14 border-b border-gold/50 ${serifHeadings}`}>
        <div className="absolute inset-0">
          <Image
            src="/images/booking-hero.jpg"
            alt="Violin and bow resting on sheet music beside a piano"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/70 to-charcoal/85" />
        <div className="relative z-10 container mx-auto px-4 text-center">
          {/* Fallback is the static HTML; props are inline because values exported from a client module are not readable here. */}
          <Suspense
            fallback={
              <BookingHeadingText
                title="Book Daniel"
                text="Ready to make your event unforgettable? Fill out the form below and I'll get back to you within 24-48 hours."
              />
            }
          >
            <BookingHeading />
          </Suspense>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-6 md:py-12 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div
              id="booking-form"
              className="scroll-mt-24 bg-cream-card rounded-2xl border border-cream-line shadow-sm p-6 md:p-12"
            >
              {/* useSearchParams bails out of static rendering. The form stays outside that boundary so its HTML is in the first response; this fallback renders nothing. */}
              <Suspense fallback={null}>
                <BookingPrefill />
              </Suspense>
              <BookingForm />
            </div>

            {/* Contact Info */}
            <div className="mt-12 text-center">
              <p className="text-ink-body mb-2">
                Prefer to talk?{' '}
                <a
                  href={phoneTelHref()}
                  className="text-gold-deep font-medium hover:text-gold-deeper hover:underline"
                >
                  Call
                </a>
                {' or '}
                <a
                  href={phoneSmsHref()}
                  className="text-gold-deep font-medium hover:text-gold-deeper hover:underline"
                >
                  text
                </a>{' '}
                <a
                  href={phoneTelHref()}
                  className="text-gold-deep font-medium hover:text-gold-deeper hover:underline"
                >
                  {site.phone}
                </a>
              </p>
              <p className="text-ink-body">
                Prefer email?{' '}
                <a
                  href={`mailto:${site.email}`}
                  className="text-gold-deep font-medium hover:text-gold-deeper hover:underline"
                >
                  {site.email}
                </a>
              </p>
              <p className="text-ink-body mt-2">
                <a
                  href={GOOGLE_REVIEWS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-deep font-medium hover:text-gold-deeper hover:underline"
                >
                  Read my reviews on Google
                </a>
              </p>
            </div>
          </div>
          <ReviewsSection variant="light" page="booking" short className="mt-12 max-w-4xl mx-auto bg-cream-card rounded-2xl border border-cream-line p-6 md:p-8" />
        </div>
      </section>
    </>
  );
}
