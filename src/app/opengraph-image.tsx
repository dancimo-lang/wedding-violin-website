import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo with violin, Central Coast wedding violinist based in San Luis Obispo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('home-image.jpg', 'Central Coast Wedding Violinist');
}
