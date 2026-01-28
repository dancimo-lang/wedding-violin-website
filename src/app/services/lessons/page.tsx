import { Metadata } from 'next';
import Hero from '@/components/Hero';
import PackageCard from '@/components/PackageCard';
import CTASection from '@/components/CTASection';
import { Monitor, MapPin, Users } from 'lucide-react';
import lessons from '@/data/lessons.json';

export const metadata: Metadata = {
  title: 'Private Violin Lessons',
  description: 'Private violin lessons in San Luis Obispo and online. All ages and skill levels welcome. Personalized instruction from a professional violinist.',
  keywords: [
    'Violin Lessons San Luis Obispo',
    'Private Violin Teacher SLO',
    'Online Violin Lessons',
    'Violin Lessons Central Coast',
  ],
};

const featureIcons = {
  'In-Person Lessons': MapPin,
  'Online Lessons': Monitor,
  'All Skill Levels': Users,
};

export default function LessonsPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title={lessons.hero.title}
        subtitle={lessons.hero.subtitle}
        description={lessons.hero.description}
        ctaText="Schedule a Lesson"
        ctaHref="/booking?service=lessons"
        posterSrc="/images/lessons-hero.jpg"
        size="large"
        overlay={false}
      />

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {lessons.features.map((feature, index) => {
              const Icon = featureIcons[feature.title as keyof typeof featureIcons] || MapPin;
              return (
                <div
                  key={index}
                  className="text-center p-8 bg-gray-50 rounded-2xl"
                >
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-amber-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-black mb-3 drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 bg-amber-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-black mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
              {lessons.philosophy.title}
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-full"></span>
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              {lessons.philosophy.description}
            </p>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
              Lesson Packages
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Flexible options to fit your schedule and goals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {lessons.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                id={pkg.id}
                name={pkg.name}
                price={pkg.price}
                features={pkg.features}
                popular={pkg.popular}
                duration={pkg.duration}
                ctaText="Book Lesson"
                ctaHref="/booking?service=lessons"
              />
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            {lessons.packages[0].priceNote}
          </p>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              What to Expect
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-semibold text-gray-900 mb-2">First Lesson</h3>
                <p className="text-gray-600 text-sm">
                  We&apos;ll assess your current level, discuss your goals, and create a personalized learning plan.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-semibold text-gray-900 mb-2">Ongoing Progress</h3>
                <p className="text-gray-600 text-sm">
                  Regular feedback, practice assignments, and milestone tracking to keep you motivated.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-semibold text-gray-900 mb-2">Repertoire</h3>
                <p className="text-gray-600 text-sm">
                  Learn pieces you love while building a strong technical foundation.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="font-semibold text-gray-900 mb-2">Performance Opportunities</h3>
                <p className="text-gray-600 text-sm">
                  Optional recitals and performance coaching for students who want stage experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title={lessons.cta.title}
        description={lessons.cta.description}
        buttonText={lessons.cta.buttonText}
        href={lessons.cta.href}
        variant="primary"
      />
    </>
  );
}
