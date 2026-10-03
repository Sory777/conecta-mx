-- HerbaNatura · 0002 · Profiles and staff roles.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'es' check (locale in ('es', 'en', 'pt', 'fr')),
  plan text not null default 'free' check (plan in ('free', 'premium')),
  -- Explicit, revocable consents (privacy by design).
  consent_history boolean not null default false,
  consent_ai_logging boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.plan is 'Derived from subscriptions by the billing webhook; never writable by the user.';

create trigger profiles_touch before update on public.profiles
  for each row execute function public.hn_touch_updated_at();

-- Staff live in their own table so a user can never promote themself by editing a profile.
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role staff_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

create or replace function public.has_staff_role(roles staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and (role = any (roles) or role = 'admin'))
$$;

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may change only safe profile columns (column-level grants in the RLS migration);
-- `plan` is written exclusively by the billing webhook with the service role.
