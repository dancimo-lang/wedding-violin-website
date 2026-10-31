'use client';

import Image from 'next/image';
import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import ReviewsSection from '@/components/ReviewsSection';
import CTASection from '@/components/CTASection';
import SingleVideo from '@/components/SingleVideo';
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
        secondaryCtaHref="/booking"
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
        <section id="see-us-play" aria-labelledby="see-us-play-heading" className="py-16 scroll-mt-20">
          <div className="container mx-auto px-4">
            <h2
              id="see-us-play-heading"
              className="text-3xl md:text-4xl font-bold text-white mb-8 text-center drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]"
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
      <section className="py-20 bg-gradient-to-br from-blue-950/30 to-blue-900/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">
              Services
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
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
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">
                Why Choose Daniel Cimo?
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,174,239,0.6)]">
                    <span className="text-white font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100 mb-1">Professional Excellence</h3>
                    <p className="text-blue-200">Years of performance experience ensuring flawless execution for your special moments.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,174,239,0.6)]">
                    <span className="text-white font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100 mb-1">Personalized Service</h3>
                    <p className="text-blue-200">Custom song selections and packages tailored to your unique vision.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,174,239,0.6)]">
                    <span className="text-white font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100 mb-1">Central Coast Local</h3>
                    <p className="text-blue-200">Based in San Luis Obispo, serving Paso Robles and the entire Central Coast region.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="relative aspect-[4/5] bg-gradient-to-br from-blue-900/40 to-blue-800/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,174,239,0.3)] ring-2 ring-blue-500/30">
                <Image
                  src="/images/home-image.jpg"
                  alt="Close-up of a violin scroll and a hand on the fingerboard"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white p-6 rounded-2xl shadow-[0_0_30px_rgba(0,174,239,0.7)] ring-2 ring-blue-400/50">
                <p className="text-3xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">20+</p>
                <p className="text-blue-100">Years Performing</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section: real Google reviews */}
      <section className="py-20 bg-gradient-to-br from-blue-950/30 to-blue-900/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <ReviewsSection page="home" title="What Clients Say" variant="dark" />
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        title="Ready to Create Unforgettable Moments?"
        description="Whether it's your wedding day, your first violin lesson, or your next recording project — let's make it special."
        buttonText="Get in Touch"
        href="/booking"
        variant="primary"
      />
    </>
  );
}
