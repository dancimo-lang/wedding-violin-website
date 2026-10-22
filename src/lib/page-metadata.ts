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
};

export function createPageMetadata({
  title,
  absoluteTitle = false,
  description,
  path,
  keywords,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${site.name}`;
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;

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
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}
