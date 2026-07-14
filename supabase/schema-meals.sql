-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists meal_suggestions (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  name        text not null,
  time        text not null,
  uses        jsonb not null default '[]',   -- string[]
  ingredients jsonb not null default '[]',   -- string[]
  steps       jsonb not null default '[]',   -- string[]
  created_at  timestamptz default now()
);

create index if not exists meal_suggestions_list_id_idx on meal_suggestions(list_id);

alter table meal_suggestions enable row level security;
create policy "No public access" on meal_suggestions for all using (false);
