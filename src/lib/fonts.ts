/**
 * Playfair Display for headings. The font itself is loaded in the root layout,
 * which sets --font-playfair on the body. This class only points headings at it.
 */
export const serifHeadings =
  '[&_h1]:font-[family-name:var(--font-playfair)] [&_h2]:font-[family-name:var(--font-playfair)] [&_h3]:font-[family-name:var(--font-playfair)]';
