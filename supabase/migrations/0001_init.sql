-- Schema and RLS for Calorie Counter (no image storage)

create extension if not exists pgcrypto;

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  item_name text not null check (char_length(item_name) <= 160),
  calories int not null check (calories >= 0 and calories <= 5000),
  protein int null check (protein >= 0 and protein <= 500),
  carbs int null check (carbs >= 0 and carbs <= 1000),
  fat int null check (fat >= 0 and fat <= 500),
  source text not null default 'user' check (source in ('user','llm_text','llm_image')),
  confidence real null check (confidence >= 0 and confidence <= 1),
  notes text null check (char_length(notes) <= 500),
  provenance jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx on public.food_entries (user_id, occurred_at desc);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create index if not exists chat_sessions_user_updated_idx on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null default '',
  has_image boolean not null default false,
  tool_name text null,
  tool_args_json jsonb null,
  tool_result_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null,
  system_text text not null,
  metadata_json jsonb null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists prompts_name_version_uniq on public.prompts (name, version);
drop index if exists prompts_single_active_uniq;
create unique index prompts_single_active_uniq on public.prompts ((case when is_active then 1 else null end));

-- triggers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_food_entries_updated on public.food_entries;
create trigger set_food_entries_updated before update on public.food_entries for each row execute function public.set_updated_at();

create or replace function public.bump_session_updated() returns trigger language plpgsql as $$
begin
  update public.chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end $$;

drop trigger if exists bump_session_on_new_message on public.chat_messages;
create trigger bump_session_on_new_message after insert on public.chat_messages for each row execute function public.bump_session_updated();

-- RLS
alter table public.food_entries enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.prompts enable row level security;

-- Policies (self access)
drop policy if exists fe_select on public.food_entries;
drop policy if exists fe_insert on public.food_entries;
drop policy if exists fe_update on public.food_entries;
drop policy if exists fe_delete on public.food_entries;
create policy fe_select on public.food_entries for select using (user_id = auth.uid());
create policy fe_insert on public.food_entries for insert with check (user_id = auth.uid());
create policy fe_update on public.food_entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fe_delete on public.food_entries for delete using (user_id = auth.uid());

drop policy if exists cs_select on public.chat_sessions;
drop policy if exists cs_insert on public.chat_sessions;
drop policy if exists cs_update on public.chat_sessions;
drop policy if exists cs_delete on public.chat_sessions;
create policy cs_select on public.chat_sessions for select using (user_id = auth.uid());
create policy cs_insert on public.chat_sessions for insert with check (user_id = auth.uid());
create policy cs_update on public.chat_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cs_delete on public.chat_sessions for delete using (user_id = auth.uid());

drop policy if exists cm_select on public.chat_messages;
drop policy if exists cm_insert on public.chat_messages;
drop policy if exists cm_update on public.chat_messages;
drop policy if exists cm_delete on public.chat_messages;
create policy cm_select on public.chat_messages for select using (user_id = auth.uid());
create policy cm_insert on public.chat_messages for insert with check (user_id = auth.uid());
create policy cm_update on public.chat_messages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cm_delete on public.chat_messages for delete using (user_id = auth.uid());

drop policy if exists prompts_read on public.prompts;
drop policy if exists prompts_write on public.prompts;
create policy prompts_read on public.prompts for select to authenticated using (true);
create policy prompts_write on public.prompts for all to authenticated using ((auth.jwt() ->> 'role') = 'admin') with check ((auth.jwt() ->> 'role') = 'admin');

