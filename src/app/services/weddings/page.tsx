'use client';

import Link from 'next/link';
import { Heart, Clock, Music, CloudSun, MapPin, Instagram } from 'lucide-react';
import { serifHeadings } from '@/lib/fonts';
import GoldDivider from '@/components/GoldDivider';
import Hero from '@/components/Hero';
import PackageCard from '@/components/PackageCard';
import SingleVideo from '@/components/SingleVideo';
import SoundCloudPlaylist from '@/components/SoundCloudPlaylist';
import music from '@/data/music.json';
import CTASection from '@/components/CTASection';
import FAQSection from '@/components/FAQSection';
import faq from '@/data/faq.json';
import ReviewsSection from '@/components/ReviewsSection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';
import weddings from '@/data/weddings.json';
import towns from '@/data/towns.json';
import site from '@/data/site.json';
import { getWeddingVideoEmbeds } from '@/data/weddingVideos';

const iconMap = {
  'Service Area': MapPin,
  'Setup & Sound Check': Clock,
  'Custom Song Requests': Music,
  'Outdoor Weddings': CloudSun,
};

// Shown elsewhere on the site, but not wedding reviews, so left off this page only.
const NON_WEDDING_REVIEW_IDS = ['tamara', 'meg'];

// Same experience claims as the FAQ ("over 20 years", "over 10", "over 10").
const EXPERIENCE_STATS = [
  { value: '20+', label: 'Years Playing Violin' },
  { value: '10+', label: 'Years Playing Weddings' },
  { value: '10+', label: 'Years Teaching' },
];

function packageDetail(label: string, value: string | null) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return { label, value };
}

export default function WeddingsPage() {
  const weddingVideoEmbeds = getWeddingVideoEmbeds();

  const scrollToSampler = () => {
    document.getElementById('wedding-sampler')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToPackages = () => {
    document.getElementById('wedding-packages')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`bg-charcoal ${serifHeadings}`}>
      <JsonLd
        data={generateServiceSchema({
          name: 'Wedding Violin Services',
          description: weddings.hero.description,
          url: 'https://danielcimo.com/services/weddings',
        })}
      />

      {/* Hero Section */}
      <Hero
        title={weddings.hero.title}
        subtitle={weddings.hero.subtitle}
        description={weddings.hero.description}
        ctaText="Book Now"
        ctaTone="gold"
        ctaHref="/booking?service=weddings#booking-form"
        secondaryCtaText="Pricing"
        secondaryCtaOnClick={scrollToPackages}
        tertiaryCtaText="Listen"
        tertiaryCtaOnClick={scrollToSampler}
        posterSrc="/images/weddings-hero-violin.jpg"
        posterAlt="Daniel seated on a sunlit winery patio playing violin, with vineyard rows and a white wall behind him"
        imageClassName="max-md:object-[48%_center] md:origin-left md:scale-[1.18] md:object-left"
        overlayClassName="max-md:bg-black/60 md:bg-gradient-to-r md:from-black/70 md:via-black/50 md:to-black/25"
        contentAlign="left"
        size="large"
      />

      {/* Audio samples and video, right after the hero */}
      <section id="wedding-sampler" aria-labelledby="sampler-heading" className="py-20 md:py-24 bg-charcoal scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-start gap-10">
            <div className="min-w-0 flex-1">
              <GoldDivider />
              <h2 id="sampler-heading" className="text-3xl md:text-4xl font-semibold text-cream-bright mb-4 text-center">
                Wedding Repertoire Samples
              </h2>
              <p className="text-lg text-cream-muted text-center mb-8 max-w-2xl mx-auto">
                Violin and Guitar versions of commonly requested Ceremony songs
              </p>
              <SoundCloudPlaylist playlistUrl={music.soundcloud.embedUrl} />
              <p className="text-center text-sm text-cream-dim mt-4">
                Wedding violin repertoire featuring classical and contemporary pieces perfect for ceremonies
              </p>
            </div>

            <aside
              aria-labelledby="see-us-play-heading"
              className="w-full max-w-xs mx-auto lg:mx-0 lg:w-80 lg:shrink-0"
            >
              <GoldDivider />
              <h2 id="see-us-play-heading" className="text-3xl md:text-4xl font-semibold text-cream-bright mb-4 text-center mb-6">
                See Us Play
              </h2>

              {weddingVideoEmbeds.length > 0 ? (
                <div className="space-y-6">
                  {weddingVideoEmbeds.map((video) => (
                    <SingleVideo
                      key={video.videoId}
                      videoId={video.videoId}
                      title={video.title}
                      orientation={video.orientation}
                      showTitle={false}
                    />
                  ))}
                  <a
                    href={site.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="See more on Instagram, opens in a new tab"
                    className="inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-gold-bright hover:text-cream-bright underline underline-offset-2 transition-colors"
                  >
                    <Instagram size={16} aria-hidden="true" />
                    See more on Instagram
                  </a>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 shadow-lg rounded-2xl p-8 text-center">
                  <p className="text-gray-600 leading-relaxed">
                    Watch clips from real weddings on Instagram
                  </p>
                  <a
                    href={site.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Watch on Instagram, opens in a new tab"
                    className="inline-flex w-full items-center justify-center gap-2 mt-6 py-3 px-6 rounded-full font-semibold bg-gold text-charcoal hover:bg-gold-hover transition-colors"
                  >
                    <Instagram size={18} aria-hidden="true" />
                    Watch on Instagram
                  </a>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="wedding-packages" aria-labelledby="packages-heading" className="py-20 md:py-24 bg-cream scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <GoldDivider />
              <h2 id="packages-heading" className="text-3xl md:text-4xl font-semibold text-ink mb-4 text-center">
                Wedding Packages
              </h2>
              <p className="text-lg text-ink-body max-w-2xl mx-auto">
                Choose the perfect package for your special day. All packages include custom song selection and professional service.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {weddings.packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  id={pkg.id}
                  name={pkg.name}
                  price={pkg.price}
                  features={pkg.features}
                  popular={pkg.popular}
                  tone="gold"
                  ctaText="Book Now"
                  ctaHref="/booking?service=weddings#booking-form"
                  details={[
                    packageDetail('Recommended lead time', pkg.leadTime),
                  ].filter((item): item is { label: string; value: string } => item !== null)}
                />
              ))}
            </div>

            <p className="text-center text-ink-body mt-12">
              Travel is free within San Luis Obispo County.{' '}
              <a href="#travel-fees" className="font-semibold text-gold-deep underline underline-offset-2 hover:text-gold-deeper">
                See travel fees
              </a>{' '}
              for weddings farther away.
            </p>
          </div>
        </div>
      </section>

      {/* Reviews with experience stats */}
      <section id="reviews" className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4">
          <GoldDivider />
          <ReviewsSection variant="gold" page="weddings" title="What Clients Say" exclude={NON_WEDDING_REVIEW_IDS}>
            <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-10 text-center" aria-label="Experience">
              {EXPERIENCE_STATS.map((stat) => (
                <li key={stat.label}>
                  <span className="block text-3xl font-semibold text-gold font-[family-name:var(--font-playfair)]">{stat.value}</span>
                  <span className="text-sm text-cream-muted">{stat.label}</span>
                </li>
              ))}
            </ul>
          </ReviewsSection>
        </div>
      </section>

      {/* Logistics: what to expect, travel fees and areas served */}
      <section id="logistics" aria-labelledby="logistics-heading" className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <GoldDivider />
            <h2 id="logistics-heading" className="text-3xl md:text-4xl font-semibold text-ink mb-4 text-center mb-10">
              {weddings.logistics.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {weddings.logistics.items.map((item, index) => {
                const IconComponent = iconMap[item.title as keyof typeof iconMap] || MapPin;
                return (
                  <div key={index} className="flex gap-4 bg-cream-card p-6 rounded-lg border border-cream-line">
                    <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-gold-deep" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-ink mb-2">{item.title}</h3>
                      <p className="text-ink-body text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div id="travel-fees" className="mt-8 bg-cream-card rounded-lg border border-cream-line p-6 md:p-8 scroll-mt-24">
              <h3 id="travel-fees-heading" className="text-2xl font-semibold text-ink mb-2 text-center">
                {weddings.travelFees.title}
              </h3>
              <p className="text-ink-body text-center mb-6">{weddings.travelFees.description}</p>
              <dl className="divide-y divide-cream-line">
                {weddings.travelFees.tiers.map((tier) => (
                  <div key={tier.area} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-6 py-4">
                    <dt className="min-w-0">
                      <span className="font-semibold text-ink">{tier.area}</span>
                      {tier.examples && <span className="block text-sm text-ink-soft mt-1">{tier.examples}</span>}
                    </dt>
                    <dd className="font-semibold text-gold-deep sm:text-right sm:max-w-[14rem] sm:flex-shrink-0">{tier.fee}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-ink-body mt-4 text-center">{weddings.travelFees.note}</p>
            </div>

            <div id="areas" className="mt-8 text-center">
              <h3 id="areas-heading" className="text-2xl font-semibold text-ink mb-4">Areas I Serve</h3>
              <ul className="flex flex-wrap justify-center gap-3">
                {towns.towns.map((town) => (
                  <li key={town.slug}>
                    <Link
                      href={`/services/weddings/${town.slug}`}
                      className="inline-block bg-cream-card border border-gold text-gold-deeper hover:bg-cream px-4 py-2 rounded-full font-semibold text-sm transition-colors"
                    >
                      {town.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection tone="gold" title={faq.title} items={faq.items} />

      {/* Proposal banner */}
      <section aria-labelledby="proposal-heading" className="py-14 bg-cream border-t border-gold/40">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-6 text-center md:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 border border-gold rounded-full mx-auto md:mx-0 flex-shrink-0">
              <Heart className="w-6 h-6 text-gold-deep" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 id="proposal-heading" className="text-2xl font-semibold text-ink mb-2">
                {weddings.proposal.title}
              </h2>
              <p className="text-ink-body leading-relaxed">{weddings.proposal.description}</p>
            </div>
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <Link
              href="/booking?service=proposal#plan-proposal"
              className="inline-block bg-charcoal hover:bg-charcoal-hover text-cream-bright px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Plan Your Proposal
            </Link>
              <Link
                href="/services/proposals"
                className="text-sm font-semibold text-gold-deep underline underline-offset-2 hover:text-gold-deeper"
              >
                Learn more<span className="sr-only"> about proposals</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        title={weddings.cta.title}
        description={weddings.cta.description}
        buttonText={weddings.cta.buttonText}
        href={weddings.cta.href}
        variant="gold"
      />
    </div>
  );
}
