import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo with violin on the private lessons page';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('lessons-hero.jpg', 'Private Violin Lessons');
}
