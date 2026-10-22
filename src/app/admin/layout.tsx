import type { Metadata } from 'next';
import site from '@/data/site.json';

const title = `${site.name} - ${site.tagline}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description: site.description,
  alternates: {},
  robots: { index: false, follow: false },
  openGraph: {
    title,
    description: site.description,
  },
  twitter: {
    card: 'summary',
    title,
    description: site.description,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
