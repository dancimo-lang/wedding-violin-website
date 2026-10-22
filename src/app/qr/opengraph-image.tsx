import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Daniel Cimo with violin, for the QR code that links to danielcimo.com';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('home-image.jpg', 'danielcimo.com');
}
