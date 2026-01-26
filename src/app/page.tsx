import Image from 'next/image';
import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import TestimonialCard from '@/components/TestimonialCard';
import CTASection from '@/components/CTASection';
import site from '@/data/site.json';
import services from '@/data/services.json';
import testimonials from '@/data/testimonials.json';

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <Hero
        title={`${site.tagline} for Your Special Day`}
        subtitle="San Luis Obispo • Paso Robles • Central Coast"
        description="Elegant live violin music for weddings, private lessons for all ages, and professional studio recording services."
        ctaText="Book Now"
        ctaHref="/booking"
        secondaryCtaText="View Services"
        secondaryCtaHref="/services"
        videoSrc="/videos/hero-video.mp4"
        posterSrc="/images/hero-poster.jpg"
        size="full"
      />

      {/* Services Section */}
      <section className="py-20 bg-gradient-to-br from-blue-950/30 to-blue-900/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-blue-50 mb-4 drop-shadow-[0_0_25px_rgba(0,174,239,0.5)]">
              Services
            </h2>
            <p className="text-lg text-blue-200 max-w-2xl mx-auto">
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
              <h2 className="text-3xl md:text-4xl font-bold text-blue-50 mb-6 drop-shadow-[0_0_25px_rgba(0,174,239,0.5)]">
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
              <div className="aspect-[4/5] bg-gradient-to-br from-blue-900/40 to-blue-800/30 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,174,239,0.3)] ring-2 ring-blue-500/30">
                <Image
                  src="/images/home-image.jpg"
                  alt="Daniel Cimo - Professional Violinist"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
                  priority
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white p-6 rounded-2xl shadow-[0_0_30px_rgba(0,174,239,0.7)] ring-2 ring-blue-400/50">
                <p className="text-3xl font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">10+</p>
                <p className="text-blue-100">Years Experience</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-br from-blue-950/30 to-blue-900/20 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-blue-50 mb-4 drop-shadow-[0_0_25px_rgba(0,174,239,0.5)]">
              What Clients Say
            </h2>
            <p className="text-lg text-blue-200">
              Trusted by couples and students across the Central Coast
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.testimonials.map((testimonial) => (
              <TestimonialCard
                key={testimonial.id}
                quote={testimonial.quote}
                author={testimonial.author}
                event={testimonial.event}
                location={testimonial.location}
              />
            ))}
          </div>
          <p className="text-center text-sm text-blue-300/60 mt-8">
            {testimonials.note}
          </p>
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
