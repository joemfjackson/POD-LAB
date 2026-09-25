-- POD Lab — agent registry, durable job queue, runs, outputs, approval gates.

create type public.job_status as enum (
  'queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled'
);

create type public.run_status as enum ('running', 'succeeded', 'failed');

create type public.approval_gate_type as enum (
  'opportunity_approval', 'brand_name_final', 'brand_identity_final', 'design_production',
  'compliance_override', 'product_assortment', 'store_launch', 'paid_campaign_spend',
  'scale_approval', 'provider_credentials', 'destructive_action'
);

create type public.approval_status as enum (
  'pending', 'approved', 'rejected', 'revision_requested', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Agents (per-workspace configuration of the registered agent definitions)
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{3,60}$'),
  name text not null,
  description text not null default '',
  phase integer not null default 1 check (phase between 1 and 5),
  enabled boolean not null default true,
  -- null = inherit workspace / environment default
  provider text,
  model text,
  temperature numeric(3, 2) check (temperature is null or (temperature >= 0 and temperature <= 2)),
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens between 256 and 64000),
  daily_run_limit integer not null default 50 check (daily_run_limit between 0 and 10000),
  daily_cost_limit_usd numeric(10, 2) not null default 5.00 check (daily_cost_limit_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create trigger agents_updated_at before update on public.agents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Durable job queue (PostgreSQL-backed; claimed with SKIP LOCKED)
-- ---------------------------------------------------------------------------
create table public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  agent_key text not null,
  type text not null,
  status public.job_status not null default 'queued',
  priority integer not null default 100 check (priority between 0 and 1000),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  error text,
  result_summary text,
  dedupe_key text,
  brand_id uuid references public.brands (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  mission_id uuid references public.research_missions (id) on delete set null,
  parent_job_id uuid references public.agent_jobs (id) on delete set null,
  requested_by uuid references public.users (id) on delete set null,
  requested_by_actor public.actor_type not null default 'human',
  locked_by text,
  locked_at timestamptz,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

-- One active job per dedupe key prevents accidental duplicate execution.
create unique index agent_jobs_dedupe_active_idx on public.agent_jobs (workspace_id, dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');
create index agent_jobs_claim_idx on public.agent_jobs (status, priority, scheduled_at) where status = 'queued';
create index agent_jobs_ws_idx on public.agent_jobs (workspace_id, created_at desc);
create index agent_jobs_brand_idx on public.agent_jobs (brand_id, created_at desc);

create trigger agent_jobs_code before insert on public.agent_jobs
  for each row execute function public.assign_code('JOB');
create trigger agent_jobs_updated_at before update on public.agent_jobs
  for each row execute function public.set_updated_at();

alter table public.research_missions add column job_id uuid references public.agent_jobs (id) on delete set null;

-- Atomically claim a specific job (or the next runnable one) for a worker.
create or replace function public.claim_agent_job(worker text, target_job uuid default null, target_workspace uuid default null)
returns setof public.agent_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.agent_jobs%rowtype;
begin
  select * into j
  from public.agent_jobs
  where status = 'queued'
    and scheduled_at <= now()
    and attempts < max_attempts
    and (target_job is null or id = target_job)
    and (target_workspace is null or workspace_id = target_workspace)
  order by priority asc, scheduled_at asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  update public.agent_jobs
     set status = 'running',
         attempts = attempts + 1,
         locked_by = worker,
         locked_at = now(),
         started_at = coalesce(started_at, now()),
         error = null
   where id = j.id
   returning * into j;

  return next j;
end;
$$;

revoke execute on function public.claim_agent_job(text, uuid, uuid) from public, anon, authenticated;

-- Jobs stuck in 'running' (worker crashed / function timeout) are re-queued or failed.
create or replace function public.recover_stale_agent_jobs(stale_after_seconds integer default 900)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.agent_jobs
     set status = case when attempts >= max_attempts then 'failed'::public.job_status else 'queued'::public.job_status end,
         error = coalesce(error, 'Worker timed out; job recovered'),
         locked_by = null,
         locked_at = null,
         completed_at = case when attempts >= max_attempts then now() else null end
   where status = 'running'
     and locked_at < now() - make_interval(secs => stale_after_seconds);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.recover_stale_agent_jobs(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agent runs (one per attempt) and validated outputs
-- ---------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_id uuid not null references public.agent_jobs (id) on delete cascade,
  agent_key text not null,
  attempt integer not null default 1,
  status public.run_status not null default 'running',
  provider text not null,
  model text not null,
  temperature numeric(3, 2),
  prompt_version text not null,
  schema_version text not null,
  input jsonb not null default '{}'::jsonb,
  raw_output text,
  error text,
  validation_errors jsonb,
  validation_retries integer not null default 0,
  input_tokens integer,
  output_tokens integer,
  usage_is_estimated boolean not null default true,
  estimated_cost_usd numeric(12, 6) not null default 0,
  sources jsonb not null default '[]'::jsonb,
  duration_ms integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_runs_job_idx on public.agent_runs (job_id, attempt);
create index agent_runs_ws_agent_idx on public.agent_runs (workspace_id, agent_key, started_at desc);
create index agent_runs_ws_started_idx on public.agent_runs (workspace_id, started_at desc);

create trigger agent_runs_updated_at before update on public.agent_runs
  for each row execute function public.set_updated_at();

alter table public.research_reports
  add constraint research_reports_run_fk foreign key (agent_run_id) references public.agent_runs (id) on delete set null;

create table public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  job_id uuid not null references public.agent_jobs (id) on delete cascade,
  agent_key text not null,
  output_type text not null,
  schema_version text not null,
  -- only outputs that passed Zod validation are ever stored here
  data jsonb not null,
  brand_id uuid references public.brands (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_outputs_job_idx on public.agent_outputs (job_id);
create index agent_outputs_brand_idx on public.agent_outputs (brand_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Human approval gates
-- ---------------------------------------------------------------------------
create table public.approval_gates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  gate_type public.approval_gate_type not null,
  status public.approval_status not null default 'pending',
  subject_type text not null,
  subject_id uuid not null,
  brand_id uuid references public.brands (id) on delete cascade,
  job_id uuid references public.agent_jobs (id) on delete set null,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  requested_by uuid references public.users (id) on delete set null,
  requested_by_actor public.actor_type not null default 'agent',
  decided_by uuid references public.users (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

-- Only one open gate per subject + gate type.
create unique index approval_gates_one_pending_idx on public.approval_gates (gate_type, subject_id)
  where status = 'pending';
create index approval_gates_ws_status_idx on public.approval_gates (workspace_id, status, created_at desc);
create index approval_gates_brand_idx on public.approval_gates (brand_id);

create trigger approval_gates_code before insert on public.approval_gates
  for each row execute function public.assign_code('APR');
create trigger approval_gates_updated_at before update on public.approval_gates
  for each row execute function public.set_updated_at();

create table public.approval_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  gate_id uuid not null references public.approval_gates (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index approval_comments_gate_idx on public.approval_comments (gate_id, created_at);

-- Minimum role required to decide each gate type (mirrors src/domain/permissions.ts).
create or replace function public.gate_min_role(g public.approval_gate_type)
returns public.workspace_role
language sql
immutable
set search_path = ''
as $$
  select case g
    when 'provider_credentials' then 'owner'::public.workspace_role
    when 'destructive_action' then 'admin'::public.workspace_role
    when 'paid_campaign_spend' then 'admin'::public.workspace_role
    when 'scale_approval' then 'admin'::public.workspace_role
    when 'store_launch' then 'admin'::public.workspace_role
    when 'compliance_override' then 'admin'::public.workspace_role
    else 'editor'::public.workspace_role
  end;
$$;

-- ---------------------------------------------------------------------------
-- Encrypted provider credentials — never readable by browser clients.
-- Ciphertext is produced server-side (AES-256-GCM, POD_LAB_ENCRYPTION_KEY).
-- ---------------------------------------------------------------------------
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_kind text not null check (provider_kind in ('ai', 'research', 'image', 'fulfillment', 'commerce')),
  provider_key text not null,
  label text not null,
  ciphertext text not null,
  hint text,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'active', 'rejected', 'revoked')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_credentials_ws_idx on public.provider_credentials (workspace_id, provider_kind, provider_key);
create unique index provider_credentials_one_active_idx on public.provider_credentials (workspace_id, provider_kind, provider_key)
  where status = 'active';

create trigger provider_credentials_updated_at before update on public.provider_credentials
  for each row execute function public.set_updated_at();
