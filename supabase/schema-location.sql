-- Add storage location to items
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/kkfmtsxfeqquvwnxarwy/sql/new

alter table items add column if not exists location text not null default 'fridge';
