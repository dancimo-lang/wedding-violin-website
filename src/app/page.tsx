'use client';

import Image from 'next/image';
import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import ReviewsSection from '@/components/ReviewsSection';
import CTASection from '@/components/CTASection';
import SingleVideo from '@/components/SingleVideo';
import GoldDivider from '@/components/GoldDivider';
import { getWeddingVideoEmbeds } from '@/data/weddingVideos';
import site from '@/data/site.json';
import services from '@/data/services.json';

export default function Home() {
  const homeVideo = getWeddingVideoEmbeds()[0];

  return (
    <>
      {/* Hero Section */}
      <Hero
        title={`${site.tagline} for Your Special Day`}
        subtitle="San Luis Obispo • Paso Robles • Central Coast"
        description="Elegant live violin music for weddings, private lessons for all ages, and professional studio recording services."
        ctaText="Listen"
        ctaHref="/services/weddings#wedding-sampler"
        secondaryCtaText="Book Now"
        secondaryCtaHref="/booking#booking-form"
        tertiaryCtaText="Watch Video"
        tertiaryCtaOnClick={() => {
          const target = document.getElementById('see-us-play');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          else window.location.href = '/music#video-player';
        }}
        splitLayout={true}
        leftSideImage={undefined}
        rightSideImage="/images/violinwalking.jpg"
        rightSideImageAlt="Daniel walking on a tree-lined path in a dark suit, carrying a violin and bow"
        size="full"
      />

      {/* Featured performance clip (click-to-load) */}
      {homeVideo && (
        <section id="see-us-play" aria-labelledby="see-us-play-heading" className="py-16 md:py-20 scroll-mt-20 bg-charcoal">
          <div className="container mx-auto px-4">
            <GoldDivider />
            <h2
              id="see-us-play-heading"
              className="text-3xl md:text-4xl font-semibold text-cream-bright mb-8 text-center"
            >
              See Us Play
            </h2>
            <SingleVideo
              videoId={homeVideo.videoId}
              title={homeVideo.title}
              orientation={homeVideo.orientation}
              showTitle={false}
            />
          </div>
        </section>
      )}

      {/* Services Section */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-4">
              Services
            </h2>
            <p className="text-lg text-ink-body max-w-2xl mx-auto">
              From wedding ceremonies to private instruction, I bring passion and professionalism to every performance.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {services.services.map((service) => (
              <ServiceCard
                key={service.id}
                title={service.title}
                description={service.shortDescription}
                icon={service.icon}
                href={service.href}
                featured={service.featured}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-cream-bright mb-6">
                Why Choose Daniel Cimo?
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cream-bright mb-1">Professional Excellence</h3>
                    <p className="text-cream-muted">Years of performance experience ensuring flawless execution for your special moments.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cream-bright mb-1">Personalized Service</h3>
                    <p className="text-cream-muted">Custom song selections and packages tailored to your unique vision.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cream-bright mb-1">Central Coast Local</h3>
                    <p className="text-cream-muted">Based in San Luis Obispo, serving Paso Robles and the entire Central Coast region.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden ring-2 ring-gold/40">
                <Image
                  src="/images/home-image.jpg"
                  alt="Close-up of a violin scroll and a hand on the fingerboard"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-charcoal text-cream-bright p-6 rounded-2xl border border-gold">
                <p className="text-3xl font-semibold text-gold">20+</p>
                <p className="text-cream-muted">Years Performing</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section: real Google reviews */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <ReviewsSection page="home" title="What Clients Say" />
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        title="Ready to Create Unforgettable Moments?"
        description="Whether it's your wedding day, your first violin lesson, or your next recording project — let's make it special."
        buttonText="Get in Touch"
        href="/booking#booking-form"
        variant="primary"
      />
    </>
  );
}
