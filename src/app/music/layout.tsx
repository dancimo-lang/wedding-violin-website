import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Music & Video',
  description:
    'Watch featured violin performances and hear the wedding sampler, from classical and contemporary ceremony pieces to jazz, cocktail, pop, and fiddle tunes.',
  path: '/music',
});

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
