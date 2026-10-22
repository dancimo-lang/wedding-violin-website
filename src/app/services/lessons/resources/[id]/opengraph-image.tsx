import { createOgImage } from '@/lib/og-image';
import { getTunes } from '@/lib/tunes';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  const tunes = await getTunes();
  const tune = tunes.find((item) => item.id === id);

  return [
    {
      id: 'preview',
      alt: tune
        ? `${tune.title} sheet music in Daniel Cimo's violin tune library`
        : 'Daniel Cimo violin tune library',
      size,
      contentType,
    },
  ];
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const tunes = await getTunes();
  const tune = tunes.find((item) => item.id === id);
  return createOgImage('lessons-hero.jpg', tune?.title ?? 'Tune Library');
}
