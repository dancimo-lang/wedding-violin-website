import { createOgImage } from '@/lib/og-image';

export const runtime = 'nodejs';
export const alt = 'Portrait of Daniel Cimo used with the printable wallet business card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createOgImage('daniel-cimo-professional.jpg', 'Business Card');
}
