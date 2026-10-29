'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { publishBookingPrefill } from './booking-prefill-store';

export default function BookingPrefill() {
  const searchParams = useSearchParams();
  const service = searchParams.get('service') || '';
  const packageName = searchParams.get('package') || '';

  useEffect(() => {
    publishBookingPrefill({ service, packageName });
  }, [service, packageName]);

  return null;
}
