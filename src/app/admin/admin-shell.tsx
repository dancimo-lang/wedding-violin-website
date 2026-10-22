'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/add-tune', label: 'Add Tune' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEmail() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const claim = data?.claims?.email;
        if (!cancelled && typeof claim === 'string') setEmail(claim);
      } catch {
        // The proxy already blocked anyone who is not signed in as an admin.
      }
    }
    loadEmail();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 admin-readable">
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              {email && <p className="text-sm text-gray-600">{email}</p>}
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-300 whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
