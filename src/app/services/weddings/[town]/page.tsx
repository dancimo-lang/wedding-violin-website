import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import ReviewsSection from '@/components/ReviewsSection';
import CTASection from '@/components/CTASection';
import { JsonLd } from '@/components/SEO';
import { createPageMetadata } from '@/lib/page-metadata';
import towns from '@/data/towns.json';
import weddings from '@/data/weddings.json';
import site from '@/data/site.json';

type Params = { town: string };

function findTown(slug: string) {
  return towns.towns.find((t) => t.slug === slug);
}

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return towns.towns.map((t) => ({ town: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const town = findTown((await params).town);
  if (!town) return {};
  return createPageMetadata({
    title: town.metaTitle,
    description: town.metaDescription,
    path: `/services/weddings/${town.slug}`,
  });
}

export default async function TownWeddingPage({ params }: { params: Promise<Params> }) {
  const town = findTown((await params).town);
  if (!town) notFound();
  const url = `https://danielcimo.com/services/weddings/${town.slug}`;
  const area = { '@type': 'City', name: `${town.name}, CA` };

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'ProfessionalService',
            name: site.name,
            url: 'https://danielcimo.com',
            email: site.email,
            address: {
              '@type': 'PostalAddress',
              addressLocality: site.location.city,
              addressRegion: site.location.state,
              addressCountry: 'US',
            },
            areaServed: area,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: `Wedding violin in ${town.name}`,
            serviceType: 'Wedding music',
            description: town.metaDescription,
            url,
            provider: { '@type': 'Person', name: site.name },
            areaServed: area,
          },
        ]}
      />

      <section className="pt-32 pb-16 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-700 mb-4">
              <Link href="/services/weddings" className="underline underline-offset-2 hover:text-gray-900">
                Weddings
              </Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{town.name}</span>
            </nav>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Wedding Violinist in {town.name}
            </h1>
            <div className="space-y-4 text-lg text-gray-800 leading-relaxed">
              {town.intro.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href={`/booking?service=weddings#booking-form`}
                className="inline-block bg-amber-700 hover:bg-amber-800 text-white px-8 py-4 rounded-full font-semibold transition-colors"
              >
                Book Now
              </Link>
              <Link
                href="/services/weddings#wedding-packages"
                className="inline-block border-2 border-amber-700 text-amber-900 hover:bg-amber-100 px-8 py-4 rounded-full font-semibold transition-colors"
              >
                See Packages
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50" aria-labelledby="tips-heading">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto grid gap-10 md:grid-cols-2">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 id="tips-heading" className="text-xl font-bold text-gray-900 mb-4">{town.tipsTitle}</h2>
              <ul className="space-y-3">
                {town.tips.map((tip) => (
                  <li key={tip} className="flex gap-3 text-gray-700">
                    <Check className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Packages</h2>
              <ul className="space-y-2 text-gray-700">
                {weddings.packages.map((pkg) => (
                  <li key={pkg.id} className="flex justify-between gap-4">
                    <span>{pkg.name}</span>
                    <span className="font-semibold text-amber-800 whitespace-nowrap">
                      {pkg.price.replace('Starting at ', 'from ')}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-gray-700 mt-4">
                Travel is free within San Luis Obispo County, including {town.name}.
              </p>
              <p className="mt-4 text-sm">
                <Link href="/services/weddings#wedding-packages" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
                  Package details
                </Link>
                <span aria-hidden="true"> · </span>
                <Link href="/services/weddings#faq" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
                  Wedding FAQ
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-rose-50 to-amber-50">
        <div className="container mx-auto px-4">
          <ReviewsSection page="weddings" title="What Clients Say" short />
        </div>
      </section>

      <CTASection
        title={`Planning a ${town.name} Wedding?`}
        description="Tell me about your day, and I'll get back to you within 24-48 hours."
        buttonText="Request a Quote"
        href="/booking?service=weddings#booking-form"
        variant="primary"
      />
    </>
  );
}
