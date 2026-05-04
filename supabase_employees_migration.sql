-- =====================================================
-- Devmate Finance Center — Salaries Ledger Update
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add columns for reordering and type to existing salaries_ledger table
ALTER TABLE salaries_ledger ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'project';
ALTER TABLE salaries_ledger ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Ensure the employees table exists (in case the previous migration wasn't run)
CREATE TABLE IF NOT EXISTS employees (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT,
  department    TEXT,
  email         TEXT,
  phone         TEXT,
  base_salary   NUMERIC DEFAULT 0,
  join_date     DATE,
  status        TEXT DEFAULT 'active',
  notes         TEXT,
  salary_type   TEXT DEFAULT 'monthly',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security on employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Allow all operations on employees (if not already added)
DROP POLICY IF EXISTS "Allow all employees" ON employees;
CREATE POLICY "Allow all employees" ON employees
  FOR ALL USING (true) WITH CHECK (true);
