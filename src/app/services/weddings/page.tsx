import { Metadata } from 'next';
import Link from 'next/link';
import { Heart, Clock, Music, CloudSun, MapPin } from 'lucide-react';
import Hero from '@/components/Hero';
import PackageCard from '@/components/PackageCard';
import CTASection from '@/components/CTASection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';
import weddings from '@/data/weddings.json';

export const metadata: Metadata = {
  title: 'Wedding Violin Services',
  description: 'Professional wedding violinist for ceremonies, cocktail hours, and receptions. Serving San Luis Obispo, Paso Robles, and the Central Coast. Solo violin and violin-guitar duo packages available.',
  keywords: [
    'Central Coast Wedding Violinist',
    'San Luis Obispo Wedding Violinist',
    'Paso Robles Wedding Violinist',
    'Wedding Ceremony Violin',
    'Cocktail Hour Violin Music',
    'Wedding DJ Services SLO',
  ],
};

const iconMap = {
  'Service Area': MapPin,
  'Setup & Sound Check': Clock,
  'Custom Song Requests': Music,
  'Outdoor Weddings': CloudSun,
};

export default function WeddingsPage() {
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
        posterSrc="/images/weddings-hero.jpg"
        size="large"
      />

      {/* Proposal Section */}
      <section className="py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-6">
              <Heart className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {weddings.proposal.title}
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

      {/* Packages Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Wedding Packages
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the perfect package for your special day. All packages include custom song selection and professional service.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
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
              />
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            {weddings.packages[0].priceNote}
          </p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-amber-700">100+</p>
              <p className="text-gray-600 text-sm mt-1">Weddings Performed</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-700">5★</p>
              <p className="text-gray-600 text-sm mt-1">Average Rating</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-700">10+</p>
              <p className="text-gray-600 text-sm mt-1">Years Experience</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-amber-700">50mi</p>
              <p className="text-gray-600 text-sm mt-1">Service Radius</p>
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
