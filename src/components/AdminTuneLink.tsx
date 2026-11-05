'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { userIsAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/client';
import { getSupabasePublicEnv } from '@/lib/supabase/env';
import { goldButtonClass } from '@/components/public-button';

/** The public library stays free of the admin link unless this browser is signed in as an admin. */
export function AdminTuneLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!getSupabasePublicEnv()) return;
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getClaims();
        const userId = data?.claims?.sub;
        if (!userId || cancelled) return;
        const allowed = await userIsAdmin(supabase, userId);
        if (!cancelled && allowed) setIsAdmin(true);
      } catch {
        // Visitors keep the public library.
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <div className="mb-6 flex justify-end">
      <Link href="/admin/add-tune" className={goldButtonClass}>
        <BookOpen className="h-4 w-4" aria-hidden />
        Add New Tune
      </Link>
    </div>
  );
}
