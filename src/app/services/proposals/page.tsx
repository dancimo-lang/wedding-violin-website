import Link from 'next/link';
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
const BUTTON = 'inline-block bg-[#c9a961] hover:bg-[#d8bc7c] text-[#14171f] px-8 py-4 rounded-full font-semibold text-lg transition-colors';

const included = [
  'Solo violin at your proposal',
  '3 songs of your choice: any song you want, learned just for you',
  'Help planning the moment: the cue and where to stay hidden',
  'Free travel within San Luis Obispo County',
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
    <div className={`bg-[#14171f] ${serifHeadings}`}>
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

      {/* Header */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-20 border-b border-[#c9a961]/40">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-sm uppercase tracking-widest text-[#e6cf95] mb-4">Proposals</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-[#f3ede0] mb-6">{weddings.proposal.title}</h1>
          <p className="text-lg text-[#d9d1c1] leading-relaxed mb-8">{weddings.proposal.description}</p>
          <p className="text-2xl font-semibold text-[#c9a961] mb-8 font-[family-name:var(--font-playfair)]">
            Starting at $250
          </p>
          <Link href={BOOK_HREF} className={BUTTON}>
            Plan Your Proposal
          </Link>
        </div>
      </section>

      <ProposalVideo />

      {/* What's included */}
      <section aria-labelledby="included-heading" className="py-20 md:py-24 bg-[#f4eddc]">
        <div className="container mx-auto px-4 max-w-3xl">
          <GoldDivider />
          <h2 id="included-heading" className="text-3xl md:text-4xl font-semibold text-[#1d1a15] mb-10 text-center">
            What&apos;s Included
          </h2>
          <div className="bg-[#fbf7ee] border-2 border-[#c9a961] rounded-xl p-8 shadow-sm">
            <p className="text-center text-2xl font-semibold text-[#7a5c1e] mb-6 font-[family-name:var(--font-playfair)]">
              Starting at $250
            </p>
            <ul className="space-y-4">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9a7a35]" aria-hidden="true" />
                  <span className="text-[#4a4338]">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[#4a4338] mt-6 text-center">
              Outside San Luis Obispo County, the{' '}
              <Link href="/services/weddings#travel-fees" className="font-semibold text-[#7a5c1e] underline underline-offset-2 hover:text-[#5c4413]">
                travel fees
              </Link>{' '}
              apply.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="py-20 md:py-24 bg-[#14171f]">
        <div className="container mx-auto px-4 max-w-5xl">
          <GoldDivider />
          <h2 id="how-heading" className="text-3xl md:text-4xl font-semibold text-[#f3ede0] mb-12 text-center">
            How It Works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-[#1d2230] border border-[#c9a961]/30 rounded-xl p-6">
                <span className="block text-3xl font-semibold text-[#c9a961] mb-3 font-[family-name:var(--font-playfair)]" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold text-[#f3ede0] mb-2">{step.title}</h3>
                <p className="text-[#d9d1c1] text-sm leading-relaxed">{step.text}</p>
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
