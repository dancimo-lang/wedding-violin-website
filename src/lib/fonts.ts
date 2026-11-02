import { Playfair_Display } from 'next/font/google';

/** Serif for headings on the weddings page and booking header. */
export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-playfair',
});

/** Apply to a wrapper: sets the variable and uses the serif for its h1-h3. */
export const serifHeadings = `${playfair.variable} [&_h1]:font-[family-name:var(--font-playfair)] [&_h2]:font-[family-name:var(--font-playfair)] [&_h3]:font-[family-name:var(--font-playfair)]`;
