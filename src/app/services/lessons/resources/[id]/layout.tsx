import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/page-metadata';
import { getTunes, tuneDescription } from '@/lib/tunes';

const missingDescription =
  'This tune is not in the violin sheet music library. Please go back to the tune library to browse sheet music and video tutorials for private violin lessons.';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tunes = await getTunes();
  const tune = tunes.find((item) => item.id === id);
  const path = `/services/lessons/resources/${encodeURIComponent(id)}`;

  if (!tune) {
    return createPageMetadata({
      title: 'Tune Not Found',
      description: missingDescription,
      path,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `${tune.title} Sheet Music`,
    description: tuneDescription(tune),
    path,
  });
}

export default function TuneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
