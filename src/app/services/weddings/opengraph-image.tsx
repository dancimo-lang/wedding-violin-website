import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo, San Luis Obispo wedding violinist, in the weddings page photo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('weddings-hero.jpg', 'San Luis Obispo Wedding Violinist');
}
