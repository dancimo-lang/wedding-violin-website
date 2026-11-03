import ReviewsSection from '@/components/ReviewsSection';
import Link from 'next/link';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import GoldDivider from '@/components/GoldDivider';
import { Monitor, MapPin, Users } from 'lucide-react';
import { createPageMetadata } from '@/lib/page-metadata';
import lessons from '@/data/lessons.json';

export const metadata = createPageMetadata({
  title: 'Private Violin Lessons',
  description:
    'In-person or online violin and fiddle lessons in San Luis Obispo for every skill level. Technique, theory, and improvisation tailored to your musical style.',
  path: '/services/lessons',
  keywords: [
    'Violin Lessons San Luis Obispo',
    'Private Violin Teacher SLO',
    'Online Violin Lessons',
    'Violin Lessons Central Coast',
  ],
});

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
        ctaHref="/booking?service=lessons#booking-form"
        secondaryCtaText="Student Resources"
        secondaryCtaHref="/services/lessons/resources"
        posterSrc="/images/lessons-hero.jpg"
        posterAlt="Daniel playing violin indoors beside a microphone"
        size="large"
        overlay={false}
      />

      {/* Features Section */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {lessons.features.map((feature, index) => {
              const Icon = featureIcons[feature.title as keyof typeof featureIcons] || MapPin;
              return (
                <div
                  key={index}
                  className="text-center p-8 bg-cream-card rounded-2xl border border-cream-line"
                >
                  <div className="w-16 h-16 border border-gold rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-gold-deep" />
                  </div>
                  <h3 className="text-xl font-semibold text-ink mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-ink-body">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 md:py-24 bg-cream-card">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-6">
              {lessons.philosophy.title}
            </h2>
            <p className="text-lg text-ink-body leading-relaxed">
              {lessons.philosophy.description}
            </p>
          </div>
        </div>
      </section>

      {/* Student reviews (Google) */}
      <section id="reviews" className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <ReviewsSection page="lessons" title="What Students Say" />
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-20 md:py-24 bg-cream-card">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-8 text-center">
              What to Expect
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-cream p-6 rounded-xl border border-cream-line">
                <h3 className="font-semibold text-ink mb-2">First Lesson</h3>
                <p className="text-ink-body text-sm">
                  We&apos;ll assess your current level, discuss your goals, and create a personalized learning plan.
                </p>
              </div>
              <div className="bg-cream p-6 rounded-xl border border-cream-line">
                <h3 className="font-semibold text-ink mb-2">Ongoing Progress</h3>
                <p className="text-ink-body text-sm">
                  Regular feedback, practice assignments, and milestone tracking to keep you motivated.
                </p>
              </div>
              <div className="bg-cream p-6 rounded-xl border border-cream-line">
                <h3 className="font-semibold text-ink mb-2">Repertoire</h3>
                <p className="text-ink-body text-sm">
                  Learn pieces you love while building a strong technical foundation.
                </p>
              </div>
              <div className="bg-cream p-6 rounded-xl border border-cream-line">
                <h3 className="font-semibold text-ink mb-2">Performance Opportunities</h3>
                <p className="text-ink-body text-sm">
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
