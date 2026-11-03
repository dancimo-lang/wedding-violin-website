import ReviewsSection from '@/components/ReviewsSection';
import Link from 'next/link';
import Image from 'next/image';
import Hero from '@/components/Hero';
import GoldDivider from '@/components/GoldDivider';
import { createPageMetadata } from '@/lib/page-metadata';
import { btnGold } from '@/lib/theme';
import about from '@/data/about.json';
import { isPublishableCopy } from '@/lib/publicContent';

export const metadata = createPageMetadata({
  title: 'Violinist, Educator & Recording Artist',
  description:
    'A San Luis Obispo violinist blending classical repertoire, gypsy jazz, traditional fiddle, and improvisation. Performer, teacher, and recording artist.',
  path: '/about',
  keywords: ['San Luis Obispo Violinist', 'Central Coast Musician', 'Violin Teacher SLO'],
});

export default function AboutPage() {
  const training = about.credentials.items.filter((item) => isPublishableCopy(item));

  return (
    <>
      {/* Hero */}
      <Hero
        title={about.hero.title}
        subtitle={about.hero.subtitle}
        splitLayout={true}
        leftSideImage={undefined}
        rightSideImage="/images/0N1A8246.jpg"
        rightSideImageAlt="Daniel playing violin on a paved path through a park"
        size="full"
      />

      {/* Biography Section */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Photo */}
            <div className="relative">
              <div className="aspect-[3/4] bg-cream-line rounded-2xl overflow-hidden border border-cream-line">
                <Image
                  src="/images/daniel-cimo-professional.jpg"
                  alt="Daniel in a black tuxedo playing violin against a wooden wall"
                  width={600}
                  height={800}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Bio Content */}
            <div>
              <GoldDivider />
              <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-6 text-center">
                Biography
              </h2>
              <div className="prose prose-lg space-y-4">
                {about.bio.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {training.length > 0 && (
        <section className="py-20 md:py-24 bg-cream-card">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <GoldDivider />
              <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-8 text-center">
                {about.credentials.title}
              </h2>
              <ul className="bg-cream p-8 rounded-2xl border border-cream-line space-y-3">
                {training.map((item) => (
                  <li key={item} className="text-ink-body flex items-start gap-3">
                    <span className="mt-2 w-1.5 h-1.5 bg-gold rounded-full flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Review from a fellow musician (Google) */}
      <section id="reviews" className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4">
          <GoldDivider />
          <ReviewsSection variant="gold" page="about" title="From a Fellow Musician" />
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Performance Philosophy */}
              <div className="bg-cream-card p-8 rounded-2xl border border-cream-line">
                <h3 className="text-xl font-semibold text-ink mb-4">
                  {about.philosophy.performance.title}
                </h3>
                <p className="text-ink-body">
                  {about.philosophy.performance.description}
                </p>
              </div>

              {/* Teaching Philosophy */}
              <div className="bg-cream-card p-8 rounded-2xl border border-cream-line">
                <h3 className="text-xl font-semibold text-ink mb-4">
                  {about.philosophy.teaching.title}
                </h3>
                <p className="text-ink-body">
                  {about.philosophy.teaching.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual CTA Section */}
      <section className="py-20 md:py-24 bg-charcoal border-t border-gold/40">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Booking CTA */}
            <div className="bg-cream-card p-8 rounded-2xl text-center border border-cream-line">
              <h3 className="text-2xl font-semibold text-ink mb-3">
                {about.cta.booking.title}
              </h3>
              <p className="text-ink-body mb-6">
                {about.cta.booking.description}
              </p>
              <Link href={about.cta.booking.href} className={btnGold}>
                {about.cta.booking.buttonText}
              </Link>
            </div>

            {/* Lessons CTA */}
            <div className="bg-cream-card p-8 rounded-2xl text-center border border-cream-line">
              <h3 className="text-2xl font-semibold text-ink mb-3">
                {about.cta.lessons.title}
              </h3>
              <p className="text-ink-body mb-6">
                {about.cta.lessons.description}
              </p>
              <Link href={about.cta.lessons.href} className={btnGold}>
                {about.cta.lessons.buttonText}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
