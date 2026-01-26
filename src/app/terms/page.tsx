import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Daniel Cimo Violin services.',
  robots: 'noindex, nofollow',
};

export default function TermsPage() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto prose prose-lg">
          <h1>Terms of Service</h1>
          <p className="text-gray-500">Last updated: [TODO: Add date]</p>
          
          <h2>Services</h2>
          <p>
            Daniel Cimo provides professional violin performance, private instruction,
            and studio recording services. All bookings are subject to availability.
          </p>

          <h2>Booking & Payment</h2>
          <p>
            [TODO: Add booking terms, deposit requirements, payment schedules, etc.]
          </p>

          <h2>Cancellation Policy</h2>
          <p>
            [TODO: Add cancellation and refund policies]
          </p>

          <h2>Liability</h2>
          <p>
            [TODO: Add liability limitations and disclaimers]
          </p>

          <h2>Contact</h2>
          <p>
            For questions about these terms, please contact us at{' '}
            <a href="mailto:contact@danielcimo.com">contact@danielcimo.com</a>.
          </p>

          <p className="text-sm text-gray-400 mt-8">
            TODO: This is a placeholder terms of service. Please consult with a legal professional
            to create comprehensive terms that protect your business.
          </p>
        </div>
      </div>
    </section>
  );
}
