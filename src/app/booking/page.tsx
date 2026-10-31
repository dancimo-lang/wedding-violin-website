import { Suspense } from 'react';
import Image from 'next/image';
import site from '@/data/site.json';
import { GOOGLE_REVIEWS_URL } from '@/data/googleReviews';
import { phoneSmsHref, phoneTelHref } from '@/lib/phone';
import BookingForm from './booking-form';
import ReviewsSection from '@/components/ReviewsSection';
import BookingPrefill from './booking-prefill';

export default function BookingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-20">
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
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/50 to-amber-900/70" />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Book Daniel
          </h1>
          <p className="text-xl text-amber-100 max-w-2xl mx-auto drop-shadow-lg">
            Ready to make your event unforgettable? Fill out the form below and I&apos;ll get back to you within 24-48 hours.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <ReviewsSection page="booking" short variant="dark" className="mb-12" />
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
              {/* useSearchParams bails out of static rendering. The form stays outside that boundary so its HTML is in the first response; this fallback renders nothing. */}
              <Suspense fallback={null}>
                <BookingPrefill />
              </Suspense>
              <BookingForm />
            </div>

            {/* Contact Info */}
            <div className="mt-12 text-center">
              <p className="text-gray-600 mb-2">
                Prefer to talk?{' '}
                <a
                  href={phoneTelHref()}
                  className="text-amber-700 font-medium hover:underline"
                >
                  Call
                </a>
                {' or '}
                <a
                  href={phoneSmsHref()}
                  className="text-amber-700 font-medium hover:underline"
                >
                  text
                </a>{' '}
                <a
                  href={phoneTelHref()}
                  className="text-amber-700 font-medium hover:underline"
                >
                  {site.phone}
                </a>
              </p>
              <p className="text-gray-600">
                Prefer email?{' '}
                <a
                  href="mailto:dancimo@gmail.com"
                  className="text-amber-700 font-medium hover:underline"
                >
                  dancimo@gmail.com
                </a>
              </p>
              <p className="text-gray-600 mt-2">
                <a
                  href={GOOGLE_REVIEWS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 font-medium hover:underline"
                >
                  Read my reviews on Google
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
