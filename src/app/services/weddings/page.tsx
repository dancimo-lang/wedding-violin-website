'use client';

import Link from 'next/link';
import { Heart, Clock, Music, CloudSun, MapPin, Instagram } from 'lucide-react';
import Hero from '@/components/Hero';
import PackageCard from '@/components/PackageCard';
import SingleVideo from '@/components/SingleVideo';
import SoundCloudPlaylist from '@/components/SoundCloudPlaylist';
import CTASection from '@/components/CTASection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';
import weddings from '@/data/weddings.json';
import site from '@/data/site.json';
import { getWeddingVideoEmbeds } from '@/data/weddingVideos';

const iconMap = {
  'Service Area': MapPin,
  'Setup & Sound Check': Clock,
  'Custom Song Requests': Music,
  'Outdoor Weddings': CloudSun,
};

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
        ctaText="Request a Quote"
        ctaHref="/booking?service=weddings"
        secondaryCtaText="Pricing"
        secondaryCtaOnClick={scrollToPackages}
        tertiaryCtaText="Listen"
        tertiaryCtaOnClick={scrollToSampler}
        posterSrc="/images/weddings-hero.jpg"
        posterAlt="Daniel playing violin outdoors in a black suit, with trees and blue sky behind him"
        size="large"
      />

      {/* Proposal Section */}
      <section className="py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-6">
              <Heart className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
              {weddings.proposal.title}
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"></span>
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto">
              {weddings.proposal.description}
            </p>
            <Link
              href="/booking?service=proposal"
              className="inline-block mt-8 bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-full font-semibold transition-colors"
            >
              Plan Your Proposal
            </Link>
          </div>
        </div>
      </section>

      {/* Packages and wedding video sit side by side on large screens */}
      <section id="wedding-packages" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-start gap-12 lg:gap-10">
            <div className="min-w-0 flex-1">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  Wedding Packages
                </h2>
                <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                  Choose the perfect package for your special day. All packages include custom song selection and professional service.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {weddings.packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    id={pkg.id}
                    name={pkg.name}
                    price={pkg.price}
                    features={pkg.features}
                    popular={pkg.popular}
                    ctaText="Request Quote"
                    ctaHref="/booking?service=weddings"
                    details={[
                      packageDetail('Duration', pkg.duration),
                      packageDetail('What raises the price', pkg.priceFactors),
                      packageDetail('Recommended lead time', pkg.leadTime),
                    ].filter((item): item is { label: string; value: string } => item !== null)}
                  />
                ))}
              </div>
            </div>

            <aside
              aria-labelledby="see-us-play-heading"
              className="w-full max-w-xs mx-auto lg:mx-0 lg:w-80 lg:shrink-0"
            >
              <h2
                id="see-us-play-heading"
                className="text-3xl font-bold text-white mb-6 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
              >
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
                    className="inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-amber-100 hover:text-white transition-colors"
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

      {/* Audio Samples Section */}
      <section id="wedding-sampler" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
              Wedding Repertoire Samples
            </h2>
            <p className="text-lg text-gray-700 text-center mb-8 max-w-2xl mx-auto">
              Violin and Guitar versions of commonly requested Ceremony songs
            </p>
            <SoundCloudPlaylist playlistUrl="https://soundcloud.com/daniel-francesco-cimo/sets/wedding-violin-sampler" />
            <p className="text-center text-sm text-gray-600 mt-4">
              Wedding violin repertoire featuring classical and contemporary pieces perfect for ceremonies
            </p>
          </div>
        </div>
      </section>

      {/* Logistics Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">
              {weddings.logistics.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {weddings.logistics.items.map((item, index) => {
                const IconComponent = iconMap[item.title as keyof typeof iconMap] || MapPin;
                return (
                  <div
                    key={index}
                    className="flex gap-4 bg-white p-6 rounded-xl shadow-md"
                  >
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 border-t border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-amber-700">5★</p>
              <p className="text-gray-600 text-sm mt-1">Average Rating</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-700">10+</p>
              <p className="text-gray-600 text-sm mt-1">Years Playing Weddings</p>
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0 px-1">
              <p className="text-4xl md:text-3xl lg:text-4xl font-bold text-amber-700 leading-tight">
                Central Coast
              </p>
              <p className="text-gray-600 text-sm mt-1">& Beyond — Travel Available</p>
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
        variant="primary"
      />
    </>
  );
}
