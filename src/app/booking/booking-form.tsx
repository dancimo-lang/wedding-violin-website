'use client';

import { useState, useSyncExternalStore } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
  getBookingPrefill,
  getServerBookingPrefill,
  subscribeBookingPrefill,
} from './booking-prefill-store';
import { BookingCalendar } from '@/components/BookingCalendar';

function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

const serviceOptions = [
  { value: 'weddings', label: 'Wedding Performance' },
  { value: 'proposal', label: 'Proposal Performance' },
  { value: 'lessons', label: 'Private Lessons' },
  { value: 'recording', label: 'Studio Recording' },
  { value: 'other', label: 'Other Event' },
];

export default function BookingForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    package: '',
    eventDate: '',
    partnerName: '',
    venueName: '',
    eventStart: '',
    guestCount: '',
    howFound: '',
    message: '',
    privacy: false,
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const prefill = useSyncExternalStore(
    subscribeBookingPrefill,
    getBookingPrefill,
    getServerBookingPrefill,
  );
  const [seenService, setSeenService] = useState(prefill.service);
  const [seenPackage, setSeenPackage] = useState(prefill.packageName);

  if (seenService !== prefill.service || seenPackage !== prefill.packageName) {
    setSeenService(prefill.service);
    setSeenPackage(prefill.packageName);
    setFormData((prev) => ({
      ...prev,
      service: prefill.service,
      package: prefill.packageName,
    }));
  }

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
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus('error');
        setErrorMessage(
          response.status === 409 || response.status === 400
            ? body.error || 'Please check the form and try again.'
            : 'Something went wrong. Please try again or email directly.'
        );
        return;
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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
          placeholder="your@email.com"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Phone <span className="text-gray-600">(optional)</span>
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors bg-white text-black"
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            readOnly
          />
        </div>
      )}

      {/* Event Date */}
      <div>
        <p id="eventDate-label" className="block text-sm font-medium text-gray-700 mb-2">
          Event Date
        </p>
        <BookingCalendar
          id="eventDate"
          value={formData.eventDate}
          onChange={(date) => setFormData((prev) => ({ ...prev, eventDate: date }))}
        />
        <p className="mt-2 text-sm text-gray-600" aria-live="polite">
          {formData.eventDate ? (
            <>
              Selected: <span className="font-medium text-gray-900">{formatDate(formData.eventDate)}</span>{' '}
              <button
                type="button"
                className="text-amber-700 hover:underline"
                onClick={() => setFormData((prev) => ({ ...prev, eventDate: '' }))}
              >
                Clear
              </button>
            </>
          ) : (
            'Pick a date, or leave it blank if you are not sure yet.'
          )}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Greyed-out dates are unavailable. Daniel personally confirms every date. Times are Pacific Time.
        </p>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <p className="text-sm font-medium text-gray-700 mb-4">A few more details, if you have them</p>
        <div className="space-y-6">
          <div>
            <label htmlFor="partnerName" className="block text-sm font-medium text-gray-700 mb-2">
              Partner&apos;s name <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              id="partnerName"
              name="partnerName"
              value={formData.partnerName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
            />
          </div>
          <div>
            <label htmlFor="venueName" className="block text-sm font-medium text-gray-700 mb-2">
              Venue <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              id="venueName"
              name="venueName"
              value={formData.venueName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="eventStart" className="block text-sm font-medium text-gray-700 mb-2">
                Start time <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="time"
                id="eventStart"
                name="eventStart"
                value={formData.eventStart}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
              />
            </div>
            <div>
              <label htmlFor="guestCount" className="block text-sm font-medium text-gray-700 mb-2">
                Guest count <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                min="1"
                id="guestCount"
                name="guestCount"
                value={formData.guestCount}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors text-black"
              />
            </div>
          </div>
          <div>
            <label htmlFor="howFound" className="block text-sm font-medium text-gray-700 mb-2">
              How did you hear about Daniel? <span className="text-gray-600">(optional)</span>
            </label>
            <select
              id="howFound"
              name="howFound"
              value={formData.howFound}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors bg-white text-black"
            >
              <option value="">Select if you would like</option>
              <option>Google</option>
              <option>Instagram</option>
              <option>Referral</option>
              <option>Wedding vendor</option>
              <option>Other</option>
            </select>
          </div>
        </div>
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
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors resize-none text-black"
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
          <a href="/privacy" className="text-amber-800 underline underline-offset-2 hover:text-amber-900">
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
