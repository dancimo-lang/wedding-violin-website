'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

const serviceOptions = [
  { value: 'weddings', label: 'Wedding Performance' },
  { value: 'proposal', label: 'Proposal Performance' },
  { value: 'lessons', label: 'Private Lessons' },
  { value: 'recording', label: 'Studio Recording' },
  { value: 'other', label: 'Other Event' },
];

function BookingForm() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    package: '',
    eventDate: '',
    message: '',
    privacy: false,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const service = searchParams.get('service') || '';
    const pkg = searchParams.get('package') || '';
    setFormData((prev) => ({
      ...prev,
      service,
      package: pkg,
    }));
  }, [searchParams]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again or email directly.');
    }
  };

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Thank You for Reaching Out!
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          I&apos;ve received your message and will get back to you within 24-48 hours.
          Looking forward to connecting with you!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
          placeholder="Your full name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
          placeholder="your@email.com"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Phone <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
          placeholder="(555) 123-4567"
        />
      </div>

      {/* Service Type */}
      <div>
        <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
          Service Type <span className="text-red-500">*</span>
        </label>
        <select
          id="service"
          name="service"
          required
          value={formData.service}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors bg-white"
        >
          <option value="">Select a service...</option>
          {serviceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Package (if prefilled) */}
      {formData.package && (
        <div>
          <label htmlFor="package" className="block text-sm font-medium text-gray-700 mb-2">
            Package
          </label>
          <input
            type="text"
            id="package"
            name="package"
            value={formData.package}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
            readOnly
          />
        </div>
      )}

      {/* Event Date */}
      <div>
        <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
          Event Date / Timeline
        </label>
        <input
          type="date"
          id="eventDate"
          name="eventDate"
          value={formData.eventDate}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          value={formData.message}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors resize-none"
          placeholder="Tell me about your event, project, or lesson goals..."
        />
      </div>

      {/* Privacy Consent */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="privacy"
          name="privacy"
          required
          checked={formData.privacy}
          onChange={handleChange}
          className="mt-1 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
        />
        <label htmlFor="privacy" className="text-sm text-gray-600">
          I agree to the{' '}
          <a href="/privacy" className="text-amber-700 hover:underline">
            Privacy Policy
          </a>{' '}
          and consent to being contacted about my inquiry.{' '}
          <span className="text-red-500">*</span>
        </label>
      </div>

      {/* Error Message */}
      {status === 'error' && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white py-4 px-6 rounded-full font-semibold text-lg transition-colors flex items-center justify-center gap-2"
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sending...
          </>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  );
}

export default function BookingPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-700 to-amber-900 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Book Daniel
          </h1>
          <p className="text-xl text-amber-100 max-w-2xl mx-auto">
            Ready to make your event unforgettable? Fill out the form below and I&apos;ll get back to you within 24-48 hours.
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
              <Suspense fallback={<div className="text-center py-8">Loading form...</div>}>
                <BookingForm />
              </Suspense>
            </div>

            {/* Contact Info */}
            <div className="mt-12 text-center">
              <p className="text-gray-600">
                Prefer email?{' '}
                <a
                  href="mailto:contact@danielcimo.com"
                  className="text-amber-700 font-medium hover:underline"
                >
                  contact@danielcimo.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
