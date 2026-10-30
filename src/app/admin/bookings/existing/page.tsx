'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PACKAGES, PACKAGE_IDS } from '@/lib/contracts/packages';
import {
  EXISTING_PAYMENT_METHODS,
  EXISTING_PAYMENT_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  packagePriceCents,
  planExistingPayments,
  dollarsToCents,
  type ExistingPackageChoice,
  type ExistingPaymentStatus,
} from '@/lib/bookings/existing-booking';

const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900';

function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AddExistingBookingPage() {
  const router = useRouter();
  const [client1Name, setClient1Name] = useState('');
  const [client2Name, setClient2Name] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [pkg, setPkg] = useState<ExistingPackageChoice>('A');
  const [totalPrice, setTotalPrice] = useState('450');
  const [paymentStatus, setPaymentStatus] = useState<ExistingPaymentStatus>('paid_in_full');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [addToGoogle, setAddToGoogle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const summary = useMemo(() => {
    const cents = dollarsToCents(totalPrice);
    if (cents == null || !weddingDate) return null;
    const plan = planExistingPayments(cents, weddingDate, paymentStatus);
    return 'error' in plan ? null : plan;
  }, [paymentStatus, totalPrice, weddingDate]);

  const choosePackage = (value: ExistingPackageChoice) => {
    setPkg(value);
    const cents = packagePriceCents(value);
    if (cents != null) setTotalPrice(String(cents / 100));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!client1Name.trim()) return setMessage('Enter Client 1 name.');
    if (!weddingDate) return setMessage('Enter the wedding date.');
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/bookings/existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client1Name,
          client2Name,
          email,
          phone,
          weddingDate,
          startTime,
          endTime,
          venueName,
          venueAddress,
          package: pkg,
          totalPrice,
          paymentStatus,
          paymentMethod,
          notes,
          addToGoogle,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; bookingId?: string; error?: string; paymentsSaved?: boolean };
      if (!response.ok || !result.ok || !result.bookingId) {
        setMessage(result.error || 'Could not save the booking.');
        return;
      }
      if (result.paymentsSaved === false) {
        setMessage('The booking was saved, but the payment record could not be saved. Record it on the Payments page.');
        return;
      }
      router.push(`/admin/bookings/${result.bookingId}`);
    } catch {
      setMessage('Could not save the booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link href="/admin/bookings" className="text-sm text-blue-700">← Bookings</Link>
      <h2 className="text-3xl font-bold text-gray-900 mt-2 mb-2">Add existing booking</h2>
      <p className="text-sm text-gray-600 mb-6">
        For a wedding already booked outside the site. It is saved as Confirmed and blocks the date.
        No email, agreement, or payment request is sent.
      </p>
      <form onSubmit={save} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm text-gray-700">Client 1 name *
            <input className={fieldClass} value={client1Name} onChange={(e) => setClient1Name(e.target.value)} required />
          </label>
          <label className="block text-sm text-gray-700">Client 2 name
            <input className={fieldClass} value={client2Name} onChange={(e) => setClient2Name(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Email
            <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Phone
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Wedding date *
            <input type="date" className={fieldClass} value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm text-gray-700">Start
              <input type="time" className={fieldClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="block text-sm text-gray-700">End
              <input type="time" className={fieldClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm text-gray-700">Venue name
            <input className={fieldClass} value={venueName} onChange={(e) => setVenueName(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Venue address
            <input className={fieldClass} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Package
            <select className={fieldClass} value={pkg} onChange={(e) => choosePackage(e.target.value as ExistingPackageChoice)}>
              {PACKAGE_IDS.map((id) => (
                <option key={id} value={id}>{PACKAGES[id].title} ({dollars(PACKAGES[id].feeCents)})</option>
              ))}
              <option value="OTHER">Other / custom</option>
            </select>
          </label>
          <label className="block text-sm text-gray-700">Total price ($)
            <input inputMode="decimal" className={fieldClass} value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} />
          </label>
          <label className="block text-sm text-gray-700">Payment status
            <select className={fieldClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as ExistingPaymentStatus)}>
              {EXISTING_PAYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-700">Payment method received
            <select className={fieldClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Not recorded</option>
              {EXISTING_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm text-gray-700">Notes
          <textarea className={fieldClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={addToGoogle} onChange={(e) => setAddToGoogle(e.target.checked)} />
          Also add to my Google Calendar
        </label>
        {summary && (
          <p className="text-sm text-gray-700">
            {summary.owedCents === 0
              ? 'Nothing owed.'
              : `Owed: ${dollars(summary.owedCents)}${paymentStatus === 'retainer_paid' && summary.balanceDueDate ? `, due ${summary.balanceDueDate}` : ''}.`}
          </p>
        )}
        <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-60">
          {saving ? 'Saving…' : 'Save booking'}
        </button>
        {message && <p className="text-sm text-red-700">{message}</p>}
      </form>
    </div>
  );
}
