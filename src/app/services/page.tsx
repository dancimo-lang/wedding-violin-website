import { Metadata } from 'next';
import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import CTASection from '@/components/CTASection';
import services from '@/data/services.json';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Professional violin services including wedding performances, private lessons, and studio recording. Serving San Luis Obispo, Paso Robles, and the Central Coast.',
  keywords: ['Wedding Violinist Services', 'Violin Lessons SLO', 'Studio Violin Recording'],
};

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title="Services"
        description="From elegant wedding performances to personalized instruction and professional recording, I bring passion and expertise to every project."
        posterSrc="/images/serveces-hero.jpg"
        backgroundPosition="center top 20%"
        size="medium"
      />

      {/* Services Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {services.services.map((service) => (
              <ServiceCard
                key={service.id}
                title={service.title}
                description={service.description}
                icon={service.icon}
                href={service.href}
                featured={service.featured}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Not Sure Which Service You Need?"
        description="Get in touch and let's discuss how I can help make your event or project special."
        buttonText="Contact Me"
        href="/booking"
        variant="dark"
      />
    </>
  );
}
