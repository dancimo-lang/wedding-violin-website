'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { adminRecordId } from './admin-shell-path';

/**
 * Id from the address bar. Null during static render and hydration so the
 * shell matches, then the browser path. Detail URLs are rewritten to one
 * static page, so this reads window.location rather than the rewrite target.
 */
export function useAdminRecordId(section: 'bookings' | 'leads'): string | null {
  const pathname = usePathname();
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => adminRecordId(window.location.pathname || pathname, section),
    () => null,
  );
}
