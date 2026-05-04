-- =====================================================
-- Devmate Finance Center — Rollover Columns Update
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add missing tracking columns for rollovers
ALTER TABLE salaries_ledger ADD COLUMN IF NOT EXISTS rolled_over BOOLEAN DEFAULT false;
ALTER TABLE salaries_ledger ADD COLUMN IF NOT EXISTS original_month TEXT;

ALTER TABLE finance_ledger ADD COLUMN IF NOT EXISTS rolled_over BOOLEAN DEFAULT false;
ALTER TABLE finance_ledger ADD COLUMN IF NOT EXISTS original_month TEXT;
