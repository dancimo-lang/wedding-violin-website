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
}

export default function FAQSection({ title, items, id = 'faq' }: FAQSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="py-20 bg-gray-50">
      <JsonLd data={generateFAQSchema(items)} />
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 id={headingId} className="text-3xl font-bold text-gray-900 mb-10 text-center">
            {title}
          </h2>
          <div className="space-y-3">
            {items.map((item) => (
              <details
                key={item.question}
                className="group bg-white rounded-xl shadow-md border border-gray-200 open:border-amber-300"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-4 font-semibold text-gray-900 hover:text-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-5 w-5 flex-shrink-0 text-amber-700 transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="px-6 pb-5 text-gray-700 leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
