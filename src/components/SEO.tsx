import site from '@/data/site.json';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export function generateMetadata({
  title,
  description,
  keywords = [],
  canonical,
  ogImage = '/images/og-default.jpg',
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name} - ${site.tagline}`;
  const fullDescription = description || site.description;
  const allKeywords = [...site.seo.keywords, ...keywords];

  return {
    title: fullTitle,
    description: fullDescription,
    keywords: allKeywords.join(', '),
    authors: [{ name: site.name }],
    creator: site.name,
    publisher: site.name,
    robots: noIndex ? 'noindex, nofollow' : 'index, follow',
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url: canonical,
      siteName: site.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [ogImage],
    },
  };
}

export function generatePersonSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    jobTitle: site.title,
    description: site.description,
    url: 'https://danielcimo.com',
    sameAs: [
      site.social.instagram,
      site.social.youtube,
      site.social.facebook,
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.location.city,
      addressRegion: site.location.state,
      addressCountry: 'US',
    },
  };
}

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: site.name,
    description: site.description,
    url: 'https://danielcimo.com',
    telephone: site.phone,
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.location.city,
      addressRegion: site.location.state,
      addressCountry: 'US',
    },
    areaServed: site.location.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
    })),
    sameAs: [
      site.social.instagram,
      site.social.youtube,
      site.social.facebook,
    ],
    priceRange: '$$',
  };
}

export function generateServiceSchema(service: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    url: service.url,
    provider: {
      '@type': 'Person',
      name: site.name,
    },
    areaServed: site.location.serviceAreas.map((area) => ({
      '@type': 'City',
      name: area,
    })),
  };
}

interface JsonLdProps {
  data: object | object[];
}

export function JsonLd({ data }: JsonLdProps) {
  const schemas = Array.isArray(data) ? data : [data];
  
  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
