import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo performing violin, with featured videos and wedding repertoire samples';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('music-hero.jpg', 'Music & Video');
}
