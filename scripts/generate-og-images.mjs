/**
 * One-off generator for static 1200x630 link-preview JPGs.
 * Not part of the Vercel build. Run locally with: node scripts/generate-og-images.mjs
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const root = process.cwd();
const outDir = join(root, 'public/og');

const pages = [
  { file: 'home.jpg', photo: 'home-image.jpg', headline: 'Central Coast Wedding Violinist' },
  { file: 'about.jpg', photo: 'daniel-cimo-professional.jpg', headline: 'Violinist, Educator & Recording Artist' },
  { file: 'services.jpg', photo: 'serveces-heroedited.jpg', headline: 'Weddings, Lessons & Recording' },
  { file: 'weddings.jpg', photo: 'weddings-hero.jpg', headline: 'San Luis Obispo Wedding Violinist' },
  { file: 'lessons.jpg', photo: 'lessons-hero.jpg', headline: 'Private Violin Lessons' },
  { file: 'tune-library.jpg', photo: 'lessons-hero.jpg', headline: 'Violin Tune Library' },
  { file: 'recording.jpg', photo: 'newrecording-hero.jpg', headline: 'Studio Recording Services' },
  { file: 'music.jpg', photo: 'music-hero.jpg', headline: 'Music & Video' },
  { file: 'booking.jpg', photo: 'booking-hero.jpg', headline: 'Book Daniel' },
  { file: 'privacy.jpg', photo: 'daniel-cimo-professional.jpg', headline: 'Privacy Policy' },
  { file: 'terms.jpg', photo: 'hero-poster.jpg', headline: 'Terms of Service' },
  { file: 'business-card.jpg', photo: 'daniel-cimo-professional.jpg', headline: 'Business Card' },
  { file: 'qr.jpg', photo: 'home-image.jpg', headline: 'danielcimo.com' },
];

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function headlineSize(headline) {
  if (headline.length > 40) return 42;
  if (headline.length > 28) return 50;
  return 58;
}

function overlay(headline) {
  const size = headlineSize(headline);
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#0a1628" stop-opacity="0.96"/>
      <stop offset="48%" stop-color="#0a1628" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#0a1628" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="330" width="${WIDTH}" height="300" fill="url(#fade)"/>
  <rect x="56" y="498" width="48" height="4" rx="2" fill="#00aeef"/>
  <text x="120" y="510" font-family="Inter, DejaVu Sans, sans-serif" font-size="22" font-weight="600" fill="#7ad7ff" letter-spacing="3.5">DANIEL CIMO</text>
  <text x="56" y="572" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" font-weight="600" fill="#ffffff">${escapeXml(headline)}</text>
</svg>`);
}

await mkdir(outDir, { recursive: true });

for (const page of pages) {
  const photo = await sharp(join(root, 'public/images', page.photo))
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .toBuffer();

  await sharp(photo)
    .composite([{ input: overlay(page.headline), top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(outDir, page.file));

  console.log(`wrote public/og/${page.file}`);
}
