import { Metadata } from 'next';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { Building2, Wifi, MapPin, FileAudio } from 'lucide-react';
import recording from '@/data/recording.json';

export const metadata: Metadata = {
  title: 'Studio Recording Services',
  description: 'Professional violin recording for albums, film scores, and creative projects. In-studio and remote session services with quick turnaround.',
  keywords: [
    'Studio Violinist',
    'Session Violin Recording',
    'Remote Violin Recording',
    'Film Score Violin',
  ],
};

const serviceIcons = {
  'In-Studio Sessions': Building2,
  'Remote Sessions': Wifi,
  'Live Tracking': MapPin,
};

export default function RecordingPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title={recording.hero.title}
        subtitle={recording.hero.subtitle}
        description={recording.hero.description}
        ctaText="Request a Quote"
        ctaHref="/booking?service=recording"
        posterSrc="/images/recording-hero.jpg"
        size="large"
      />

      {/* Services Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {recording.services.map((service, index) => {
              const Icon = serviceIcons[service.title as keyof typeof serviceIcons] || Building2;
              return (
                <div
                  key={index}
                  className="text-center p-8 bg-gray-50 rounded-2xl"
                >
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-8 h-8 text-amber-700" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {service.title}
                  </h3>
                  <p className="text-gray-600">{service.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              {recording.workflow.title}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {recording.workflow.steps.map((step) => (
                <div key={step.step} className="text-center">
                  <div className="w-12 h-12 bg-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl font-bold">{step.step}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  {recording.deliverables.title}
                </h2>
                <ul className="space-y-4">
                  {recording.deliverables.items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <FileAudio className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-50 p-8 rounded-2xl">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Supported Formats
                </h3>
                <div className="flex flex-wrap gap-3">
                  {recording.formats.map((format) => (
                    <span
                      key={format}
                      className="bg-white px-4 py-2 rounded-full text-sm font-medium text-gray-700 border border-gray-200"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title={recording.cta.title}
        description={recording.cta.description}
        buttonText={recording.cta.buttonText}
        href={recording.cta.href}
        variant="primary"
      />
    </>
  );
}
