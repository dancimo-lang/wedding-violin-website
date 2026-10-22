import type { Metadata } from 'next';
import site from '@/data/site.json';

const SITE_URL = 'https://danielcimo.com';

type PageMetadataInput = {
  /** Page-specific title. The root template appends " | Daniel Cimo" unless absoluteTitle is set. */
  title: string;
  /** Use the title exactly, for the homepage default that should not gain a second site name. */
  absoluteTitle?: boolean;
  description: string;
  /** Path beginning with "/". "/" is the homepage. */
  path: string;
  keywords?: string[] | string;
  noIndex?: boolean;
  /** Overrides the alt text of the static preview image. Tune pages reuse the library image. */
  imageAlt?: string;
};

const previews: Record<string, { url: string; alt: string }> = {
  '/': {
    url: '/og/home.jpg',
    alt: 'Daniel Cimo with violin, Central Coast wedding violinist based in San Luis Obispo',
  },
  '/about': {
    url: '/og/about.jpg',
    alt: 'Portrait of Daniel Cimo, violinist, educator, and recording artist in San Luis Obispo',
  },
  '/services': {
    url: '/og/services.jpg',
    alt: 'Daniel Cimo with violin, for wedding performances, lessons, and studio recording',
  },
  '/services/weddings': {
    url: '/og/weddings.jpg',
    alt: 'Daniel Cimo, San Luis Obispo wedding violinist, in the weddings page photo',
  },
  '/services/lessons': {
    url: '/og/lessons.jpg',
    alt: 'Daniel Cimo with violin on the private lessons page',
  },
  '/services/lessons/resources': {
    url: '/og/tune-library.jpg',
    alt: 'Daniel Cimo with violin beside the student tune library of sheet music and videos',
  },
  '/services/recording': {
    url: '/og/recording.jpg',
    alt: 'Daniel Cimo recording violin for in-studio, remote, and on-location sessions',
  },
  '/music': {
    url: '/og/music.jpg',
    alt: 'Daniel Cimo performing violin, with featured videos and wedding repertoire samples',
  },
  '/booking': {
    url: '/og/booking.jpg',
    alt: 'Daniel Cimo with violin on the booking page for weddings, lessons, and recording',
  },
  '/privacy': {
    url: '/og/privacy.jpg',
    alt: 'Portrait of Daniel Cimo, whose privacy policy explains how booking inquiries are used',
  },
  '/terms': {
    url: '/og/terms.jpg',
    alt: 'Daniel Cimo with violin, for the terms covering performances, lessons, and recording',
  },
  '/business-card': {
    url: '/og/business-card.jpg',
    alt: 'Portrait of Daniel Cimo used with the printable wallet business card',
  },
  '/qr': {
    url: '/og/qr.jpg',
    alt: 'Daniel Cimo with violin, for the QR code that links to danielcimo.com',
  },
};

function resolvePreview(path: string, imageAlt?: string) {
  const direct = previews[path];
  const preview =
    direct ??
    (path.startsWith('/services/lessons/resources/')
      ? previews['/services/lessons/resources']
      : undefined);

  if (!preview) return undefined;

  return {
    url: preview.url,
    width: 1200,
    height: 630,
    alt: imageAlt ?? preview.alt,
  };
}

export function createPageMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  keywords,
  noIndex = false,
  imageAlt,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${site.name}`;
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  const preview = resolvePreview(path, imageAlt);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: url },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: site.name,
      title: fullTitle,
      description,
      url,
      ...(preview ? { images: [preview] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      ...(preview ? { images: [preview.url] } : {}),
    },
  };
}
