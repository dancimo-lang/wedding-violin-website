import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'San Luis Obispo Wedding Violinist',
  description:
    'Solo violin or violin-guitar duo, plus sound and DJ, for San Luis Obispo weddings. Custom songs, outdoor setups, and proposal performances are welcome.',
  path: '/services/weddings',
});

export default function WeddingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
