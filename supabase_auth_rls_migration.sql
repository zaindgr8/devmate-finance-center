-- =====================================================
-- Devmate Finance Center — Lock data to signed-in users
-- Run this in your Supabase SQL Editor AFTER:
--   1. Authentication → Users → "Add user" (email + password, auto-confirm)
--   2. Authentication → Providers → Email: turn OFF "Allow new users to sign up"
--   3. Deploying the app version that signs in with Supabase Auth
--
-- Before this, every table had a `USING (true)` policy, so anyone holding the
-- public anon key (it ships inside the JS bundle) could read and change all data.
-- =====================================================

DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'invoices', 'finance_ledger', 'salaries_ledger', 'app_settings', 'employees', 'bills']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop every existing policy on the table (the old "allow all" ones)
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY "Signed-in users full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- Columns the app writes that older migrations never added (safe to re-run)
ALTER TABLE salaries_ledger ADD COLUMN IF NOT EXISTS auto_pushed BOOLEAN DEFAULT false;
ALTER TABLE employees       ADD COLUMN IF NOT EXISTS base_salary NUMERIC DEFAULT 0;
ALTER TABLE employees       ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'monthly';
