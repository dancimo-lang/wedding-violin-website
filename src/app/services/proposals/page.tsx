import Link from 'next/link';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { createPageMetadata } from '@/lib/page-metadata';
import { serifHeadings } from '@/lib/fonts';
import GoldDivider from '@/components/GoldDivider';
import ProposalVideo from '@/components/ProposalVideo';
import FAQSection from '@/components/FAQSection';
import CTASection from '@/components/CTASection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';
import weddings from '@/data/weddings.json';

const DESCRIPTION =
  'Surprise violin for your proposal in San Luis Obispo and the Central Coast. Starting at $250 for solo violin and 3 songs of your choice, and we plan the moment together.';

export const metadata = createPageMetadata({
  title: 'Proposal Violinist | San Luis Obispo & Central Coast',
  absoluteTitle: true,
  description: DESCRIPTION,
  path: '/services/proposals',
  keywords: ['proposal violinist', 'San Luis Obispo proposal music', 'Central Coast proposal violin'],
});

const BOOK_HREF = '/booking?service=proposal#plan-proposal';
const BUTTON = 'inline-block bg-gold hover:bg-gold-hover text-charcoal px-8 py-4 rounded-full font-semibold text-lg transition-colors';

const included = [
  'Solo violin at your proposal',
  '3 songs of your choice: any song you want, learned just for you',
  'Help planning the moment: the cue and where to stay hidden',
  'Free travel within San Luis Obispo County',
];

const gallery = [
  { src: '/images/proposal-kneel.webp', alt: 'Kneeling proposal among white roses while Daniel plays violin nearby', w: 2000, h: 1333 },
  { src: '/images/proposal-kiss.webp', alt: 'The newly engaged couple kiss as Daniel plays violin behind them', w: 1333, h: 2000 },
  { src: '/images/proposal-dance.webp', alt: 'The engaged couple dance and laugh while Daniel plays violin', w: 1333, h: 2000 },
  { src: '/images/proposal-couple-with-daniel.webp', alt: 'The engaged couple smiling with Daniel after the proposal', w: 1333, h: 2000 },
];

const steps = [
  { title: 'Reach out', text: 'Tell me about your plan, the place and the date using the booking form.' },
  { title: 'Pick your songs', text: 'Choose 3 songs. Any song you want, and I will learn it for you.' },
  { title: 'Plan the cue', text: 'We plan it together: where I wait out of sight and the signal for when to start playing.' },
  { title: 'The moment', text: 'On your cue, the music starts and you pop the question.' },
];

// Answers restate facts already on the site (pricing above, travel tiers, faq.json).
const proposalFaq = [
  {
    question: 'How much does proposal violin cost?',
    answer: 'Proposals start at $250 for solo violin and 3 songs of your choice. Travel is free within San Luis Obispo County; travel fees apply beyond.',
  },
  {
    question: 'Can I pick any song?',
    answer: "Yes. You choose 3 songs, any song you want, and I'll learn them just for you.",
  },
  {
    question: 'Do you travel outside San Luis Obispo County?',
    answer:
      'Yes. Travel within San Luis Obispo County is free. Neighboring areas about 1.5 hours away or less are $150, longer drives of about 1.5 to 3 hours are $350, and anything farther or overnight is quoted case by case, including lodging.',
  },
  {
    question: 'How do I reserve the date?',
    answer: 'Private events, including proposals, work the same way as weddings: a 50% retainer to reserve the date, with the balance due 30 days before the event.',
  },
];

export default function ProposalsPage() {
  return (
    <div className={`bg-charcoal ${serifHeadings}`}>
      <JsonLd
        data={{
          ...generateServiceSchema({
            name: 'Proposal Violin',
            description: DESCRIPTION,
            url: 'https://danielcimo.com/services/proposals',
          }),
          offers: {
            '@type': 'Offer',
            description: 'Solo violin and 3 songs of your choice',
            priceSpecification: {
              '@type': 'PriceSpecification',
              minPrice: 250,
              priceCurrency: 'USD',
            },
          },
        }}
      />

      {/* Photo hero. Below xl the whole frame shows, so a tall cover crop cannot
          cut the couple or the violinist. On wide screens the same uncropped
          photo sits beside the copy. */}
      <section aria-labelledby="proposal-heading" className="border-b border-gold/40 bg-charcoal">
        <div className="flex flex-col xl:grid xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)] xl:items-center">
          <div className="order-2 xl:order-1">
            <div className="mx-auto max-w-3xl px-4 py-10 text-center md:py-14 xl:mx-0 xl:max-w-none xl:px-8 xl:py-12 xl:text-left">
              <p className="text-sm uppercase tracking-widest text-gold-bright mb-4">Proposals</p>
              <h1 id="proposal-heading" className="text-4xl md:text-5xl font-semibold text-cream-bright mb-6">
                {weddings.proposal.title}
              </h1>
              <p className="text-lg text-cream-muted leading-relaxed mb-8">{weddings.proposal.description}</p>
              <p className="text-2xl font-semibold text-gold mb-8 font-[family-name:var(--font-playfair)]">
                Starting at $250
              </p>
              <Link href={BOOK_HREF} className={BUTTON}>
                Plan Your Proposal
              </Link>
            </div>
          </div>
          <div className="relative order-1 xl:order-2">
            <Image
              src="/images/proposal-moment.webp"
              alt="A woman kneels to propose to her smiling partner in a white dress among white roses, while Daniel plays violin"
              width={2000}
              height={1333}
              priority
              sizes="(min-width: 1280px) calc(100vw - 28rem), 100vw"
              className="h-auto w-full"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-charcoal to-transparent xl:hidden"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-charcoal to-transparent xl:block"
            />
          </div>
        </div>
      </section>

      <ProposalVideo />

      {/* Proposal photos */}
      <section aria-labelledby="photos-heading" className="pb-20 md:pb-24 bg-charcoal">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 id="photos-heading" className="sr-only">Proposal photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gallery.map((photo) => (
              <div key={photo.src} className="aspect-[3/4] rounded-xl overflow-hidden border border-gold/30">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.w}
                  height={photo.h}
                  sizes="(min-width: 768px) 16rem, 50vw"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section aria-labelledby="included-heading" className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4 max-w-3xl">
          <GoldDivider />
          <h2 id="included-heading" className="text-3xl md:text-4xl font-semibold text-ink mb-10 text-center">
            What&apos;s Included
          </h2>
          <div className="bg-cream-card border-2 border-gold rounded-xl p-8 shadow-sm">
            <p className="text-center text-2xl font-semibold text-gold-deep mb-6 font-[family-name:var(--font-playfair)]">
              Starting at $250
            </p>
            <ul className="space-y-4">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-gold-icon" aria-hidden="true" />
                  <span className="text-ink-body">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-body mt-6 text-center">
              Outside San Luis Obispo County, the{' '}
              <Link href="/services/weddings#travel-fees" className="font-semibold text-gold-deep underline underline-offset-2 hover:text-gold-deeper">
                travel fees
              </Link>{' '}
              apply.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4 max-w-5xl">
          <GoldDivider />
          <h2 id="how-heading" className="text-3xl md:text-4xl font-semibold text-cream-bright mb-12 text-center">
            How It Works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-charcoal-raised border border-gold/30 rounded-xl p-6">
                <span className="block text-3xl font-semibold text-gold mb-3 font-[family-name:var(--font-playfair)]" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold text-cream-bright mb-2">{step.title}</h3>
                <p className="text-cream-muted text-sm leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <FAQSection id="proposal-faq" tone="gold" title="Proposal Questions" items={proposalFaq} />

      <CTASection
        title="Ready to Plan the Moment?"
        description="Tell me about your plan and we'll work out the rest together."
        buttonText="Plan Your Proposal"
        href={BOOK_HREF}
        variant="gold"
      />
    </div>
  );
}
