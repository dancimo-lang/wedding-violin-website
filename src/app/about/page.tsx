import { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import about from '@/data/about.json';

export const metadata: Metadata = {
  title: 'About Daniel Cimo',
  description: 'Learn about Daniel Cimo, a professional violinist based in San Luis Obispo, California. Specializing in wedding performances, private lessons, and studio recording.',
  keywords: ['San Luis Obispo Violinist', 'Central Coast Musician', 'Violin Teacher SLO'],
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title={about.hero.title}
        subtitle={about.hero.subtitle}
        posterSrc="/images/about-hero.jpg"
        size="medium"
      />

      {/* Biography Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Photo */}
            <div className="relative">
              <div className="aspect-[3/4] bg-gray-200 rounded-2xl overflow-hidden">
                <img
                  src="/images/daniel-cimo-professional.jpg"
                  alt="Daniel Cimo - Professional Violinist"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Bio Content */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
                Biography
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-full"></span>
              </h2>
              <div className="prose prose-lg text-gray-600 space-y-4">
                {about.bio.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Performance Philosophy */}
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {about.philosophy.performance.title}
                </h3>
                <p className="text-gray-600">
                  {about.philosophy.performance.description}
                </p>
              </div>

              {/* Teaching Philosophy */}
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {about.philosophy.teaching.title}
                </h3>
                <p className="text-gray-600">
                  {about.philosophy.teaching.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Lessons CTA */}
            <div className="bg-amber-50 p-8 rounded-2xl text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {about.cta.lessons.title}
              </h3>
              <p className="text-gray-600 mb-6">
                {about.cta.lessons.description}
              </p>
              <Link
                href={about.cta.lessons.href}
                className="inline-block bg-amber-700 hover:bg-amber-800 text-white px-6 py-3 rounded-full font-medium transition-colors"
              >
                {about.cta.lessons.buttonText}
              </Link>
            </div>

            {/* Booking CTA */}
            <div className="bg-gray-900 p-8 rounded-2xl text-center">
              <h3 className="text-2xl font-bold text-white mb-3">
                {about.cta.booking.title}
              </h3>
              <p className="text-gray-300 mb-6">
                {about.cta.booking.description}
              </p>
              <Link
                href={about.cta.booking.href}
                className="inline-block bg-white hover:bg-gray-100 text-gray-900 px-6 py-3 rounded-full font-medium transition-colors"
              >
                {about.cta.booking.buttonText}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
