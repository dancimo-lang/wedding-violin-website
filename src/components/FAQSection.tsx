import { ChevronDown } from 'lucide-react';
import { JsonLd } from '@/components/SEO';

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateFAQSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

interface FAQSectionProps {
  title: string;
  items: FAQItem[];
  id?: string;
  /** 'gold': dark section with cream cards (weddings page). */
  tone?: 'default' | 'gold';
}

export default function FAQSection({ title, items, id = 'faq', tone = 'default' }: FAQSectionProps) {
  const headingId = `${id}-heading`;
  const gold = tone === 'gold';
  return (
    <section id={id} aria-labelledby={headingId} className={gold ? 'py-20 md:py-24 bg-charcoal' : 'py-20 md:py-24 bg-cream'}>
      <JsonLd data={generateFAQSchema(items)} />
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 id={headingId} className={`text-3xl md:text-4xl font-semibold mb-10 text-center ${gold ? 'text-cream-bright' : 'text-ink'}`}>
            {title}
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <details
                key={item.question}
                className="group bg-cream-card rounded-lg border border-cream-line open:border-gold"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-4 font-semibold text-ink hover:text-gold-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-5 w-5 flex-shrink-0 text-gold-deep transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="px-6 pb-5 leading-relaxed text-ink-body">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
