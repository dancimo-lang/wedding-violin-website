import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import CTASection from '@/components/CTASection';
import { createPageMetadata } from '@/lib/page-metadata';
import services from '@/data/services.json';

export const metadata = createPageMetadata({
  title: 'Weddings, Lessons & Recording',
  description:
    'Elegant wedding performances, personalized violin lessons, and professional studio recording in San Luis Obispo, with passion and expertise for every project.',
  path: '/services',
  keywords: ['San Luis Obispo wedding violinist', 'Central Coast wedding violinist', 'wedding violin music SLO', 'Paso Robles wedding violinist', 'ceremony violinist California'],
});

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title=""
        posterSrc="/images/serveces-heroedited.jpg"
        posterAlt="Daniel playing violin on a dirt path under a canopy of trees"
        backgroundPosition="center top 20%"
        size="medium"
      />

      {/* Title Section */}
      <section className="py-16 md:py-20 bg-charcoal border-b border-gold/40 relative">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-semibold text-cream-bright mb-6">
              Services
            </h1>
            <p className="text-xl text-cream-muted max-w-3xl mx-auto">
              From elegant wedding performances to personalized instruction and professional recording, I bring passion and expertise to every project.
            </p>
          </div>
        </div>
        {/* Scroll Indicator */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold/70 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-gold rounded-full" />
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 md:py-24 bg-cream">
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
        href="/booking#booking-form"
        variant="dark"
      />
    </>
  );
}
