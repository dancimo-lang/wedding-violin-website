'use client';

import Link from 'next/link';
import { Heart, Clock, Music, CloudSun, MapPin, Instagram } from 'lucide-react';
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
    <>
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
        ctaTone="warm"
        ctaHref="/booking?service=weddings#booking-form"
        secondaryCtaText="Pricing"
        secondaryCtaOnClick={scrollToPackages}
        tertiaryCtaText="Listen"
        tertiaryCtaOnClick={scrollToSampler}
        posterSrc="/images/weddings-hero.jpg"
        posterAlt="Daniel playing violin outdoors in a black suit, with trees and blue sky behind him"
        size="large"
      />

      {/* Audio samples and video, right after the hero */}
      <section id="wedding-sampler" aria-labelledby="sampler-heading" className="py-16 md:py-20 bg-gray-50 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-start gap-10">
            <div className="min-w-0 flex-1">
              <h2 id="sampler-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Wedding Repertoire Samples
              </h2>
              <p className="text-lg text-gray-700 text-center mb-8 max-w-2xl mx-auto">
                Violin and Guitar versions of commonly requested Ceremony songs
              </p>
              <SoundCloudPlaylist playlistUrl={music.soundcloud.embedUrl} />
              <p className="text-center text-sm text-gray-600 mt-4">
                Wedding violin repertoire featuring classical and contemporary pieces perfect for ceremonies
              </p>
            </div>

            <aside
              aria-labelledby="see-us-play-heading"
              className="w-full max-w-xs mx-auto lg:mx-0 lg:w-80 lg:shrink-0"
            >
              <h2 id="see-us-play-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center mb-6">
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
                    className="inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2 transition-colors"
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
                    className="inline-flex w-full items-center justify-center gap-2 mt-6 py-3 px-6 rounded-full font-semibold bg-amber-700 text-white hover:bg-amber-800 transition-colors"
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
      <section id="wedding-packages" aria-labelledby="packages-heading" className="py-16 md:py-20 bg-white scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="packages-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
                Wedding Packages
              </h2>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
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
                  ctaText="Book Now"
                  ctaHref="/booking?service=weddings#booking-form"
                  details={[
                    packageDetail('Recommended lead time', pkg.leadTime),
                  ].filter((item): item is { label: string; value: string } => item !== null)}
                />
              ))}
            </div>

            <p className="text-center text-gray-700 mt-10">
              Travel is free within San Luis Obispo County.{' '}
              <a href="#travel-fees" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
                See travel fees
              </a>{' '}
              for weddings farther away.
            </p>
          </div>
        </div>
      </section>

      {/* Reviews with experience stats */}
      <section id="reviews" className="py-16 md:py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="container mx-auto px-4">
          <ReviewsSection page="weddings" title="What Clients Say" exclude={NON_WEDDING_REVIEW_IDS}>
            <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-10 text-center" aria-label="Experience">
              {EXPERIENCE_STATS.map((stat) => (
                <li key={stat.label}>
                  <span className="block text-2xl font-bold text-amber-800">{stat.value}</span>
                  <span className="text-sm text-gray-700">{stat.label}</span>
                </li>
              ))}
            </ul>
          </ReviewsSection>
        </div>
      </section>

      {/* Logistics: what to expect, travel fees and areas served */}
      <section id="logistics" aria-labelledby="logistics-heading" className="py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 id="logistics-heading" className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center mb-10">
              {weddings.logistics.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {weddings.logistics.items.map((item, index) => {
                const IconComponent = iconMap[item.title as keyof typeof iconMap] || MapPin;
                return (
                  <div key={index} className="flex gap-4 bg-white p-6 rounded-xl shadow-md">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-gray-600 text-sm">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div id="travel-fees" className="mt-8 bg-white rounded-xl shadow-md p-6 md:p-8 scroll-mt-24">
              <h3 id="travel-fees-heading" className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {weddings.travelFees.title}
              </h3>
              <p className="text-gray-700 text-center mb-6">{weddings.travelFees.description}</p>
              <dl className="divide-y divide-gray-200">
                {weddings.travelFees.tiers.map((tier) => (
                  <div key={tier.area} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-6 py-4">
                    <dt className="min-w-0">
                      <span className="font-semibold text-gray-900">{tier.area}</span>
                      {tier.examples && <span className="block text-sm text-gray-600 mt-1">{tier.examples}</span>}
                    </dt>
                    <dd className="font-bold text-amber-800 sm:text-right sm:max-w-[14rem] sm:flex-shrink-0">{tier.fee}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-gray-700 mt-4 text-center">{weddings.travelFees.note}</p>
            </div>

            <div id="areas" className="mt-8 text-center">
              <h3 id="areas-heading" className="text-2xl font-bold text-gray-900 mb-4">Areas I Serve</h3>
              <ul className="flex flex-wrap justify-center gap-3">
                {towns.towns.map((town) => (
                  <li key={town.slug}>
                    <Link
                      href={`/services/weddings/${town.slug}`}
                      className="inline-block bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 px-4 py-2 rounded-full font-semibold text-sm transition-colors"
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
      <FAQSection title={faq.title} items={faq.items} />

      {/* Proposal banner */}
      <section aria-labelledby="proposal-heading" className="py-10 bg-gradient-to-br from-rose-50 to-amber-50 border-t border-rose-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center gap-6 text-center md:text-left">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-rose-100 rounded-full mx-auto md:mx-0 flex-shrink-0">
              <Heart className="w-6 h-6 text-rose-600" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 id="proposal-heading" className="text-2xl font-bold text-gray-900 mb-2">
                {weddings.proposal.title}
              </h2>
              <p className="text-gray-700 leading-relaxed">{weddings.proposal.description}</p>
            </div>
            <Link
              href="/booking?service=proposal#booking-form"
              className="inline-block self-center flex-shrink-0 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Plan Your Proposal
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        title={weddings.cta.title}
        description={weddings.cta.description}
        buttonText={weddings.cta.buttonText}
        href={weddings.cta.href}
        variant="warm"
      />
    </>
  );
}
