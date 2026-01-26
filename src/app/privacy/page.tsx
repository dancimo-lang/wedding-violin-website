import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Daniel Cimo Violin services.',
  robots: 'noindex, nofollow',
};

export default function PrivacyPage() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto prose prose-lg">
          <h1>Privacy Policy</h1>
          <p className="text-gray-500">Last updated: [TODO: Add date]</p>
          
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
            <a href="mailto:contact@danielcimo.com">contact@danielcimo.com</a>.
          </p>

          <p className="text-sm text-gray-400 mt-8">
            TODO: This is a placeholder privacy policy. Please consult with a legal professional
            to create a comprehensive privacy policy that complies with applicable laws.
          </p>
        </div>
      </div>
    </section>
  );
}
