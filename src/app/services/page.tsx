import { Metadata } from 'next';
import Hero from '@/components/Hero';
import ServiceCard from '@/components/ServiceCard';
import CTASection from '@/components/CTASection';
import services from '@/data/services.json';

export const metadata: Metadata = {
  title: 'San Luis Obispo Wedding Violinist | Central Coast Wedding Violin Services',
  description: 'Professional San Luis Obispo wedding violinist providing elegant live violin music for ceremonies, cocktail hours, and receptions. Serving the entire Central Coast including Paso Robles, Pismo Beach, and Morro Bay.',
  keywords: ['San Luis Obispo wedding violinist', 'Central Coast wedding violinist', 'wedding violin music SLO', 'Paso Robles wedding violinist', 'ceremony violinist California'],
};

export default function ServicesPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title=""
        posterSrc="/images/serveces-heroedited.jpg"
        backgroundPosition="center top 20%"
        size="medium"
      />

      {/* Title Section */}
      <section className="py-12 bg-gradient-to-br from-blue-950/30 to-blue-900/20 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">
              Services
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              From elegant wedding performances to personalized instruction and professional recording, I bring passion and expertise to every project.
            </p>
          </div>
        </div>
        {/* Scroll Indicator */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-blue-300/50 rounded-full flex items-start justify-center p-2 shadow-[0_0_15px_rgba(0,174,239,0.4)]">
            <div className="w-1 h-2 bg-blue-300/70 rounded-full" />
          </div>
        </div>
      </section>

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
