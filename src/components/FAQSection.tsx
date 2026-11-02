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
    <section id={id} aria-labelledby={headingId} className={gold ? 'py-20 md:py-24 bg-[#14171f]' : 'py-20 bg-gray-50'}>
      <JsonLd data={generateFAQSchema(items)} />
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 id={headingId} className={gold ? 'text-3xl md:text-4xl font-semibold text-[#f3ede0] mb-10 text-center' : 'text-3xl font-bold text-gray-900 mb-10 text-center'}>
            {title}
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <details
                key={item.question}
                className={gold ? 'group bg-[#fbf7ee] rounded-lg border border-[#e4d9c3] open:border-[#c9a961]' : 'group bg-white rounded-xl shadow-md border border-gray-200 open:border-amber-300'}
              >
                <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${gold ? 'text-[#1d1a15] hover:text-[#7a5c1e] focus-visible:outline-[#c9a961]' : 'text-gray-900 hover:text-amber-800 focus-visible:outline-amber-700'}`}>
                  <span>{item.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-5 w-5 flex-shrink-0 transition-transform group-open:rotate-180 ${gold ? 'text-[#7a5c1e]' : 'text-amber-700'}`}
                  />
                </summary>
                <p className={`px-6 pb-5 leading-relaxed ${gold ? 'text-[#4a4338]' : 'text-gray-700'}`}>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
