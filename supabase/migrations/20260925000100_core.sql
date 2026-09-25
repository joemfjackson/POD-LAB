-- POD Lab — core schema: extensions, enums, helpers, users, workspaces, membership,
-- human-readable IDs, audit log, notifications, files, notes.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'editor', 'viewer');

create type public.brand_stage as enum (
  'idea', 'researching', 'candidate', 'approved', 'branding', 'creative',
  'product_selection', 'store_build', 'launch_ready', 'testing', 'iterating',
  'scaling', 'paused', 'killed', 'archived'
);

create type public.actor_type as enum ('human', 'agent', 'system');
create type public.confidence_level as enum ('low', 'medium', 'high');
create type public.risk_level as enum ('none', 'low', 'medium', 'high', 'critical');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users (profile mirror of auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Workspaces & membership
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_by uuid references public.users (id) on delete set null,
  -- Cost controls
  daily_ai_budget_usd numeric(10, 2) not null default 10.00 check (daily_ai_budget_usd >= 0),
  max_research_depth integer not null default 2 check (max_research_depth between 1 and 5),
  max_candidates integer not null default 20 check (max_candidates between 1 and 100),
  -- AI defaults (non-secret). Secrets live in environment variables only.
  ai_provider text,
  ai_default_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

create trigger workspace_members_updated_at before update on public.workspace_members
  for each row execute function public.set_updated_at();

create or replace function public.workspace_role_rank(r public.workspace_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
  end;
$$;

create or replace function public.has_workspace_role(ws uuid, min_role public.workspace_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and public.workspace_role_rank(m.role) >= public.workspace_role_rank(min_role)
  );
$$;

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_workspace_role(ws, 'viewer');
$$;

-- ---------------------------------------------------------------------------
-- Human-readable IDs (PL-0001, OPP-0001, DES-0001, EXP-0001, ...)
-- ---------------------------------------------------------------------------
create table public.id_counters (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  prefix text not null check (prefix ~ '^[A-Z]{2,5}$'),
  last_value bigint not null default 0,
  primary key (workspace_id, prefix)
);

create or replace function public.format_code(prefix text, n bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Pads to at least four digits but never truncates (PL-12345 stays intact).
  select prefix || '-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end;
$$;

create or replace function public.next_code(ws uuid, code_prefix text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.id_counters as c (workspace_id, prefix, last_value)
  values (ws, code_prefix, 1)
  on conflict on constraint id_counters_pkey
  do update set last_value = c.last_value + 1
  returning c.last_value into v;
  return public.format_code(code_prefix, v);
end;
$$;

-- Trigger function: assigns NEW.code from the prefix passed as TG_ARGV[0].
create or replace function public.assign_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.next_code(new.workspace_id, tg_argv[0]);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log / activity stream
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id uuid references public.users (id) on delete set null,
  agent_key text,
  action text not null,
  subject_type text,
  subject_id uuid,
  brand_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_log_ws_created_idx on public.audit_log (workspace_id, created_at desc);
create index audit_log_brand_idx on public.audit_log (brand_id, created_at desc);
create index audit_log_subject_idx on public.audit_log (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null user_id = visible to every workspace member
  user_id uuid references public.users (id) on delete cascade,
  type text not null check (type in (
    'approval_needed', 'agent_failed', 'stage_ready', 'experiment_threshold',
    'margin_problem', 'compliance_flag', 'store_built', 'info'
  )),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  link text,
  brand_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_ws_created_idx on public.notifications (workspace_id, created_at desc);
create index notifications_unread_idx on public.notifications (workspace_id) where read_at is null;

create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Files (metadata for Supabase Storage objects)
-- ---------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid,
  bucket text not null default 'pod-lab',
  path text not null,
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 26214400),
  kind text not null default 'other' check (kind in ('design', 'mockup', 'logo', 'research', 'export', 'import', 'other')),
  uploaded_by uuid references public.users (id) on delete set null,
  uploaded_by_actor public.actor_type not null default 'human',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);

create index files_ws_idx on public.files (workspace_id, created_at desc);
create index files_brand_idx on public.files (brand_id);

create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notes (attach to any subject)
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid,
  subject_type text not null default 'brand',
  subject_id uuid,
  body text not null check (char_length(body) between 1 and 20000),
  author_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_ws_idx on public.notes (workspace_id, created_at desc);
create index notes_brand_idx on public.notes (brand_id);
create index notes_body_trgm on public.notes using gin (body extensions.gin_trgm_ops);

create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, keyed per user + bucket)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

create or replace function public.consume_rate_limit(bucket text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  k text;
  now_ts timestamptz := now();
  r public.rate_limits%rowtype;
begin
  if uid is null then
    return false;
  end if;
  k := uid::text || ':' || bucket;
  insert into public.rate_limits as rl (key, window_start, count)
  values (k, now_ts, 1)
  on conflict (key) do update
    set count = case
          when rl.window_start < now_ts - make_interval(secs => window_seconds) then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now_ts - make_interval(secs => window_seconds) then now_ts
          else rl.window_start
        end
  returning * into r;
  return r.count <= max_hits;
end;
$$;
