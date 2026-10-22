import { createPageMetadata } from '@/lib/page-metadata';

export const metadata = createPageMetadata({
  title: 'Violin Tune Library',
  description:
    'Browse violin tunes with sheet music and video tutorials. Search by name, composer, or tag, then filter the lesson tune library by type or difficulty.',
  path: '/services/lessons/resources',
});

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
