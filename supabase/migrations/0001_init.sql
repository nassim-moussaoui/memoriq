-- Memoriq — initial schema (phase 4)
-- Apply via Supabase MCP (apply_migration) or the dashboard SQL editor.
-- Device SQLite stays the source of truth; these tables are the sync target
-- plus the server-side state RevenueCat webhooks will write to in phase 5.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  locale text,
  level text,
  minutes_per_day int,
  active_surah int,
  streak int not null default 0,
  last_session_day date,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create the profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------ memorization_items
-- One row per (user, surah, ayah) being memorized; `card` is the serialized
-- FSRS card. Mirrors the on-device SQLite table.
create table public.memorization_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  surah int not null check (surah between 1 and 114),
  ayah int not null check (ayah >= 1),
  card jsonb not null,
  due_at timestamptz not null,
  state int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, surah, ayah)
);

create index memorization_items_due_idx on public.memorization_items (user_id, due_at);

alter table public.memorization_items enable row level security;

create policy "items: own all" on public.memorization_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger memorization_items_updated_at
  before update on public.memorization_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- review_logs
-- Append-only review history. `client_id` is the device-local SQLite row id,
-- unique per user so re-pushing after a failed sync cannot duplicate.
create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  surah int not null,
  ayah int not null,
  rating int not null,
  reviewed_at timestamptz not null,
  client_id bigint not null,
  unique (user_id, client_id)
);

create index review_logs_user_idx on public.review_logs (user_id, reviewed_at);

alter table public.review_logs enable row level security;

create policy "logs: own read" on public.review_logs
  for select using (auth.uid() = user_id);
create policy "logs: own insert" on public.review_logs
  for insert with check (auth.uid() = user_id);

-- ----------------------------------------------------------- subscriptions
-- Mirror of RevenueCat entitlements. Written ONLY by the phase-5 webhook
-- edge function (service role); clients read their own row.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'premium',
  status text not null,
  source text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: own read" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------- sadaqa gifting
-- Users who ask to receive a gifted subscription.
create table public.sadaqa_waitlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  country text,
  status text not null default 'waiting', -- waiting | granted
  created_at timestamptz not null default now(),
  granted_at timestamptz
);

alter table public.sadaqa_waitlist enable row level security;

create policy "waitlist: own all" on public.sadaqa_waitlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gift purchases and their attribution. Inserted/assigned by the phase-5
-- webhook + attribution edge function (service role); donors read their own.
create table public.sadaqa_gifts (
  id bigint generated always as identity primary key,
  donor_user_id uuid references auth.users (id) on delete set null,
  amount_cents int,
  currency text,
  status text not null default 'pending', -- pending | assigned
  beneficiary_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz
);

alter table public.sadaqa_gifts enable row level security;

create policy "gifts: donor read" on public.sadaqa_gifts
  for select using (auth.uid() = donor_user_id);
