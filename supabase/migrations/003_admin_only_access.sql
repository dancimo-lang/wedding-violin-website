-- Lock booking data to the site owner.
-- Migration 002 let every signed-in Supabase user read and change these tables.
-- Public sign-up would have exposed client names, emails, notes, and payments.
-- This migration replaces those policies with an admin allow-list.

CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.admins IS
  'Allow-list of Auth users who may read or change booking data. Add a row only for the site owner.';

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

REVOKE ALL ON TABLE public.admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;
GRANT ALL ON TABLE public.admins TO service_role;

DROP POLICY IF EXISTS "Users can see their own admin row" ON public.admins;
CREATE POLICY "Users can see their own admin row"
  ON public.admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Remove every previous policy on booking tables, including "any authenticated user".
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'clients',
        'leads',
        'bookings',
        'contracts',
        'payments',
        'services',
        'packages',
        'package_services',
        'notes',
        'communications',
        'availability_blocks',
        'follow_up_tasks'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients',
    'leads',
    'bookings',
    'contracts',
    'payments',
    'services',
    'packages',
    'package_services',
    'notes',
    'communications',
    'availability_blocks',
    'follow_up_tasks'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', t);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      t
    );
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);

    EXECUTE format(
      'CREATE POLICY "Admins can view %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_admin())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Admins can insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Admins can update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
    EXECUTE format(
      'CREATE POLICY "Admins can delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_admin())',
      t
    );
  END LOOP;
END $$;

-- If the owner already exists in Authentication, add them now.
-- If this inserts nothing, create the user first, then run the INSERT in SETUP.md.
INSERT INTO public.admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE lower(email) = lower('dancimo@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
