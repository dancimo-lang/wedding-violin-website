import Link from 'next/link';
import { Flower2 } from 'lucide-react';
import { createPageMetadata } from '@/lib/page-metadata';
import { serifHeadings } from '@/lib/fonts';
import GoldDivider from '@/components/GoldDivider';
import CTASection from '@/components/CTASection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';

const DESCRIPTION =
  'Live violin for celebrations of life, memorials, and funeral services.';

const BOOK_HREF = '/booking#booking-form';
const BUTTON =
  'inline-block bg-gold hover:bg-gold-hover text-charcoal px-8 py-4 rounded-full font-semibold text-lg transition-colors';

const moments = [
  {
    title: 'Prelude',
    text: 'Quiet, reflective music as guests arrive.',
  },
  {
    title: 'During the Service',
    text: 'Music for key moments such as a processional, a moment of silence, a slideshow, or a hymn guests can sing along with.',
  },
  {
    title: 'Postlude & Reception',
    text: 'Music as guests depart, and optional background music at the reception.',
  },
];

const pieces = [
  'Air on the G String (Bach)',
  'Meditation from Thaïs (Massenet)',
  'Ashokan Farewell',
  "Gabriel's Oboe",
  'Amazing Grace',
  'Be Thou My Vision',
  'How Great Thou Art',
];

export const metadata = createPageMetadata({
  title: 'Celebration of Life & Funeral Services',
  description: DESCRIPTION,
  path: '/services/celebration-of-life',
  keywords: ['celebration of life violinist'],
});

export default function CelebrationOfLifePage() {
  return (
    <div className={`bg-charcoal ${serifHeadings}`}>
      <JsonLd
        data={generateServiceSchema({
          name: 'Celebration of Life Violin',
          description: DESCRIPTION,
          url: 'https://danielcimo.com/services/celebration-of-life',
        })}
      />

      <section className="pt-28 pb-16 md:pt-36 md:pb-20 border-b border-gold/40">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold">
            <Flower2 className="h-8 w-8 text-gold" aria-hidden="true" />
          </div>
          <p className="text-sm uppercase tracking-widest text-gold-bright mb-4">Celebration of Life</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-cream-bright mb-6">
            Live Violin for a Celebration of Life
          </h1>
          <p className="text-lg text-cream-muted leading-relaxed mb-8">
            I offer live violin for celebrations of life, memorials, and funeral services.
          </p>
          <Link href={BOOK_HREF} className={BUTTON}>
            Get in Touch
          </Link>
        </div>
      </section>

      <section aria-labelledby="moments-heading" className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4 max-w-5xl">
          <GoldDivider />
          <h2 id="moments-heading" className="text-3xl md:text-4xl font-semibold text-ink mb-12 text-center">
            Music for the Service
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {moments.map((moment, index) => (
              <li key={moment.title} className="bg-cream-card border border-cream-line rounded-xl p-8 text-center">
                <span
                  className="mb-4 block text-3xl font-semibold text-gold-deep font-[family-name:var(--font-playfair)]"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold text-ink mb-3">{moment.title}</h3>
                <p className="text-ink-body leading-relaxed">{moment.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="song-heading" className="py-20 md:py-24 bg-charcoal border-t border-gold/30">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <GoldDivider />
          <h2 id="song-heading" className="text-3xl md:text-4xl font-semibold text-cream-bright mb-6">
            A Meaningful Song
          </h2>
          <p className="text-lg text-cream-muted leading-relaxed">
            I&apos;m happy to learn a special song that was meaningful to your loved one, a favorite hymn, folk tune, or popular song, on request.
          </p>
          <p className="text-lg text-cream-muted leading-relaxed mt-4">
            Graveside music can be arranged.
          </p>
        </div>
      </section>

      <section aria-labelledby="pieces-heading" className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4 max-w-3xl">
          <GoldDivider />
          <h2 id="pieces-heading" className="text-3xl md:text-4xl font-semibold text-ink mb-10 text-center">
            Examples of Pieces Often Requested
          </h2>
          <ul className="space-y-3 text-center">
            {pieces.map((piece) => (
              <li key={piece} className="text-lg text-ink font-[family-name:var(--font-playfair)]">
                {piece}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CTASection
        title="When You Are Ready"
        description="Please reach out as soon as you can and I'll do my best to accommodate."
        buttonText="Get in Touch"
        href={BOOK_HREF}
        variant="gold"
      />
    </div>
  );
}
