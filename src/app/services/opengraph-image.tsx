import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo with violin, for wedding performances, lessons, and studio recording';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('serveces-heroedited.jpg', 'Weddings, Lessons & Recording');
}
