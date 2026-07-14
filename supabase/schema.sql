-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Lists table: each "list" is a household identified by a unique slug + hashed password
create table if not exists lists (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- the user-chosen "title" e.g. "the-smith-family"
  password_hash text not null,               -- bcrypt-style hash stored via pgcrypto
  api_token   text unique not null,          -- long random token for agent API access
  created_at  timestamptz default now()
);

-- Trips table
create table if not exists trips (
  id          text primary key,
  list_id     uuid not null references lists(id) on delete cascade,
  store       text not null,
  date        text not null,                 -- ISO date string "YYYY-MM-DD"
  fees        numeric(10,2) default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Items table
create table if not exists items (
  id          text primary key,
  trip_id     text not null references trips(id) on delete cascade,
  list_id     uuid not null references lists(id) on delete cascade,
  name        text not null,
  category    text not null default 'other',
  price       numeric(10,2) not null default 0,
  qty         integer not null default 1,
  status      text not null default 'pending',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Indexes
create index if not exists trips_list_id_idx on trips(list_id);
create index if not exists items_trip_id_idx on items(trip_id);
create index if not exists items_list_id_idx on items(list_id);

-- Row-level security: all access goes through service role key (server-side only)
alter table lists enable row level security;
alter table trips enable row level security;
alter table items enable row level security;

-- No public access — all queries use service role key server-side
create policy "No public access" on lists for all using (false);
create policy "No public access" on trips for all using (false);
create policy "No public access" on items for all using (false);
