import Link from 'next/link';
import { Heart, Cake, Sparkles, Briefcase, Flower2, Music, Speaker, BatteryCharging } from 'lucide-react';
import { createPageMetadata } from '@/lib/page-metadata';
import { serifHeadings } from '@/lib/fonts';
import GoldDivider from '@/components/GoldDivider';
import HighlightVideo from '@/components/HighlightVideo';
import ReviewsSection from '@/components/ReviewsSection';
import CTASection from '@/components/CTASection';
import { JsonLd, generateServiceSchema } from '@/components/SEO';

const DESCRIPTION =
  'Live violin for birthdays, anniversaries, corporate events, memorials and proposals in San Luis Obispo and the Central Coast. Solo violin or violin–guitar duo, quoted case by case.';

export const metadata = createPageMetadata({
  title: 'Private Event Violinist | San Luis Obispo & Central Coast',
  absoluteTitle: true,
  description: DESCRIPTION,
  path: '/services/private-events',
  keywords: ['private event violinist', 'San Luis Obispo party violinist', 'celebration of life violinist', 'corporate event violinist Central Coast'],
});

// The booking form has no dedicated private-event option; "other" is its "Other Event" choice.
const QUOTE_HREF = '/booking?service=other#booking-form';
const BUTTON = 'inline-block bg-[#c9a961] hover:bg-[#d8bc7c] text-[#14171f] px-8 py-4 rounded-full font-semibold text-lg transition-colors';

const events = [
  { title: 'Birthdays', icon: Cake },
  { title: 'Anniversaries', icon: Sparkles },
  { title: 'Corporate events', icon: Briefcase },
  { title: 'Memorials and celebrations of life', icon: Flower2 },
];

const options = [
  { title: 'Solo violin or the violin–guitar duo', text: 'Choose solo violin, or the duo with guitar.', icon: Music },
  { title: 'Sound system', text: 'Speakers and microphones for your event, when you need them.', icon: Speaker },
  {
    title: 'Portable battery',
    text: 'No outlet close by? A portable battery can power the sound system. Just let me know ahead of time.',
    icon: BatteryCharging,
  },
];

export default function PrivateEventsPage() {
  return (
    <div className={`bg-[#14171f] ${serifHeadings}`}>
      <JsonLd
        data={generateServiceSchema({
          name: 'Private Event Violin',
          description: DESCRIPTION,
          url: 'https://danielcimo.com/services/private-events',
        })}
      />

      <section className="pt-28 pb-16 md:pt-36 md:pb-20 border-b border-[#c9a961]/40">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-sm uppercase tracking-widest text-[#e6cf95] mb-4">Private Events</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-[#f3ede0] mb-6">Live Violin for Your Event</h1>
          <p className="text-lg text-[#d9d1c1] leading-relaxed mb-8">
            Birthdays, anniversaries, corporate events, memorials and proposals. Every event is different, so each one is quoted case by case.
          </p>
          <Link href={QUOTE_HREF} className={BUTTON}>
            Request a Quote
          </Link>
        </div>
      </section>

      <section aria-label="Event video" className="py-14 md:py-16 bg-[#14171f]">
        <div className="container mx-auto px-4">
          <HighlightVideo
            src="/videos/private-event-highlight.mp4"
            poster="/videos/private-event-highlight-poster.jpg"
            width={864}
            height={1080}
            caption="Live violin and guitar at a private event"
            label="Video: Daniel playing live violin with a guitarist at an indoor private event"
          />
        </div>
      </section>

      <section aria-labelledby="events-heading" className="py-20 md:py-24 bg-[#f4eddc]">
        <div className="container mx-auto px-4 max-w-5xl">
          <GoldDivider />
          <h2 id="events-heading" className="text-3xl md:text-4xl font-semibold text-[#1d1a15] mb-10 text-center">
            Events I Play
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <li>
              <Link
                href="/services/proposals"
                className="flex h-full items-center gap-4 bg-[#fbf7ee] border border-[#c9a961] rounded-lg p-6 hover:bg-white transition-colors"
              >
                <span className="w-12 h-12 border border-[#c9a961] rounded-full flex items-center justify-center flex-shrink-0">
                  <Heart className="w-6 h-6 text-[#7a5c1e]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-lg font-semibold text-[#1d1a15] font-[family-name:var(--font-playfair)]">Proposals</span>
                  <span className="text-sm font-semibold text-[#7a5c1e] underline underline-offset-2">See proposals</span>
                </span>
              </Link>
            </li>
            {events.map(({ title, icon: Icon }) => (
              <li key={title} className="flex items-center gap-4 bg-[#fbf7ee] border border-[#e4d9c3] rounded-lg p-6">
                <span className="w-12 h-12 border border-[#c9a961] rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-[#7a5c1e]" aria-hidden="true" />
                </span>
                <span className="text-lg font-semibold text-[#1d1a15] font-[family-name:var(--font-playfair)]">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="options-heading" className="py-20 md:py-24 bg-[#14171f]">
        <div className="container mx-auto px-4 max-w-5xl">
          <GoldDivider />
          <h2 id="options-heading" className="text-3xl md:text-4xl font-semibold text-[#f3ede0] mb-12 text-center">
            Options
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {options.map(({ title, text, icon: Icon }) => (
              <li key={title} className="bg-[#1d2230] border border-[#c9a961]/30 rounded-xl p-6">
                <Icon className="w-8 h-8 text-[#c9a961] mb-4" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-[#f3ede0] mb-2">{title}</h3>
                <p className="text-[#d9d1c1] text-sm leading-relaxed">{text}</p>
              </li>
            ))}
          </ul>
          <p className="text-center text-[#d9d1c1] mt-12">
            Travel is free within San Luis Obispo County. Farther away, the{' '}
            <Link href="/services/weddings#travel-fees" className="font-semibold text-[#e6cf95] underline underline-offset-2 hover:text-[#f3ede0]">
              travel fees
            </Link>{' '}
            apply.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-24 bg-[#14171f] border-t border-[#c9a961]/30">
        <div className="container mx-auto px-4">
          <GoldDivider />
          <ReviewsSection variant="gold" page="private-events" title="What Clients Say" />
        </div>
      </section>

      <CTASection
        title="Tell Me About Your Event"
        description="Every event is quoted case by case. Share the details and I'll get back to you with a quote."
        buttonText="Request a Quote"
        href={QUOTE_HREF}
        variant="gold"
      />
    </div>
  );
}
