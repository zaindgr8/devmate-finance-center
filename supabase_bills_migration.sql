-- =====================================================
-- Devmate Finance Center — Bills Ledger Migration
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create the bills table
CREATE TABLE IF NOT EXISTS public.bills (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  amount        NUMERIC DEFAULT 0,
  type          TEXT DEFAULT 'one-time', -- 'monthly' or 'one-time'
  month         TEXT, -- e.g., '2026-05'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on bills
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Allow all operations on bills
DROP POLICY IF EXISTS "Allow all bills" ON public.bills;
CREATE POLICY "Allow all bills" ON public.bills
  FOR ALL USING (true) WITH CHECK (true);
