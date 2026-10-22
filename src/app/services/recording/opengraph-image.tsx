import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo recording violin for in-studio, remote, and on-location sessions';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('newrecording-hero.jpg', 'Studio Recording Services');
}
