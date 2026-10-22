import { Fragment } from 'react';
import { Metadata } from 'next';
import { isPublishableCopy } from '@/lib/publicContent';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Daniel Cimo Violin services.',
  robots: 'noindex, nofollow',
};

// Owner: a section whose text starts with TODO is omitted, including its heading.
const ownerDraft = {
  note: 'Owner: sections whose text starts with TODO are omitted, including their headings. Replace the text to publish that section. Have a lawyer review the terms before you rely on them.',
  lastUpdated: '[TODO: Add date]',
  disclaimer:
    'TODO: This is a placeholder terms of service. Please consult with a legal professional to create comprehensive terms that protect your business.',
  sections: [
    {
      heading: 'Booking & Payment',
      body: '[TODO: Add booking terms, deposit requirements, payment schedules, etc.]',
    },
    {
      heading: 'Cancellation Policy',
      body: '[TODO: Add cancellation and refund policies]',
    },
    {
      heading: 'Liability',
      body: '[TODO: Add liability limitations and disclaimers]',
    },
  ],
};

export default function TermsPage() {
  const lastUpdated = isPublishableCopy(ownerDraft.lastUpdated) ? ownerDraft.lastUpdated : null;
  const disclaimer = isPublishableCopy(ownerDraft.disclaimer) ? ownerDraft.disclaimer : null;
  const publishedSections = ownerDraft.sections.filter((section) => isPublishableCopy(section.body));

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto prose prose-lg">
          <h1>Terms of Service</h1>
          {lastUpdated && <p className="text-gray-500">Last updated: {lastUpdated}</p>}
          
          <h2>Services</h2>
          <p>
            Daniel Cimo provides professional violin performance, private instruction,
            and studio recording services. All bookings are subject to availability.
          </p>

          {publishedSections.map((section) => (
            <Fragment key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </Fragment>
          ))}

          <h2>Contact</h2>
          <p>
            For questions about these terms, please contact us at{' '}
            <a href="mailto:dancimo@gmail.com">dancimo@gmail.com</a>.
          </p>

          {disclaimer && (
            <p className="text-sm text-gray-400 mt-8">{disclaimer}</p>
          )}
        </div>
      </div>
    </section>
  );
}
