import { Metadata } from 'next';
import { isPublishableCopy } from '@/lib/publicContent';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Daniel Cimo Violin services.',
  robots: 'noindex, nofollow',
};

// Owner: replace any value that starts with TODO. Those lines are omitted until you do.
const ownerDraft = {
  note: 'Owner: replace any value that starts with TODO. Those lines are omitted from the page until you do. Have a lawyer review the published policy before you rely on it.',
  lastUpdated: '[TODO: Add date]',
  disclaimer:
    'TODO: This is a placeholder privacy policy. Please consult with a legal professional to create a comprehensive privacy policy that complies with applicable laws.',
};

export default function PrivacyPage() {
  const lastUpdated = isPublishableCopy(ownerDraft.lastUpdated) ? ownerDraft.lastUpdated : null;
  const disclaimer = isPublishableCopy(ownerDraft.disclaimer) ? ownerDraft.disclaimer : null;

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto prose prose-lg">
          <h1>Privacy Policy</h1>
          {lastUpdated && <p className="text-gray-500">Last updated: {lastUpdated}</p>}
          
          <h2>Information We Collect</h2>
          <p>
            When you use our contact form or booking system, we collect the following information:
          </p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Phone number (optional)</li>
            <li>Event details and messages you provide</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <p>
            We use the information you provide solely to:
          </p>
          <ul>
            <li>Respond to your inquiries</li>
            <li>Provide quotes and booking information</li>
            <li>Communicate about your event or lessons</li>
          </ul>

          <h2>Data Protection</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal information to third parties.
            Your data is stored securely and only accessed when necessary to provide our services.
          </p>

          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact us at{' '}
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
