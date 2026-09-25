-- POD Lab — research missions, opportunities, evidence, brands and lifecycle.

create type public.opportunity_status as enum (
  'inbox', 'researching', 'candidate', 'approved', 'rejected', 'archived'
);

create type public.mission_status as enum ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled');

create type public.evidence_kind as enum (
  'measured_fact', 'observed_signal', 'inferred_conclusion', 'assumption'
);

create type public.source_type as enum (
  'web', 'search_engine', 'marketplace', 'social', 'reddit', 'search_trends',
  'ecommerce_data', 'manual', 'internal', 'none'
);

-- ---------------------------------------------------------------------------
-- Research missions (created by humans or the Director)
-- ---------------------------------------------------------------------------
create table public.research_missions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  title text not null check (char_length(title) between 3 and 300),
  prompt text not null check (char_length(prompt) between 3 and 4000),
  mission_type text not null default 'discover' check (mission_type in ('discover', 'investigate', 'revisit')),
  max_candidates integer not null default 10 check (max_candidates between 1 and 100),
  research_depth integer not null default 1 check (research_depth between 1 and 5),
  status public.mission_status not null default 'draft',
  created_by uuid references public.users (id) on delete set null,
  brand_id uuid,
  trend_id uuid,
  opportunities_found integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create index research_missions_ws_idx on public.research_missions (workspace_id, created_at desc);

create trigger research_missions_code before insert on public.research_missions
  for each row execute function public.assign_code('MIS');
create trigger research_missions_updated_at before update on public.research_missions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Opportunities
-- ---------------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  mission_id uuid references public.research_missions (id) on delete set null,
  niche text not null check (char_length(niche) between 2 and 200),
  -- normalised niche used to prevent duplicate research of the same market
  niche_key text not null,
  hypothesis text,
  audience text,
  summary text,
  status public.opportunity_status not null default 'inbox',
  confidence public.confidence_level,
  strongest_signal text,
  biggest_risk text,
  strongest_evidence text[] not null default '{}',
  strongest_risks text[] not null default '{}',
  recommended_customer text,
  recommended_brand_angle text,
  recommended_first_products text[] not null default '{}',
  recommended_test_strategy text,
  suggested_sub_niches text[] not null default '{}',
  seasonality text check (seasonality in ('evergreen', 'seasonal', 'mixed', 'unknown')),
  ip_risk_notes text,
  geographic_notes text,
  cultural_risk_notes text,
  researched_at timestamptz,
  research_mode text check (research_mode in ('live', 'model_only', 'demo', 'manual')),
  brand_id uuid,
  rejected_reason text,
  is_demo boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  unique (workspace_id, niche_key)
);

create index opportunities_ws_status_idx on public.opportunities (workspace_id, status, created_at desc);
create index opportunities_niche_trgm on public.opportunities using gin (niche extensions.gin_trgm_ops);

create trigger opportunities_code before insert on public.opportunities
  for each row execute function public.assign_code('OPP');
create trigger opportunities_updated_at before update on public.opportunities
  for each row execute function public.set_updated_at();

create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  dimension text not null check (dimension in (
    'demand', 'identity_strength', 'giftability', 'personalization', 'product_depth',
    'content_depth', 'margin_potential', 'competitive_opportunity', 'trend_resilience', 'brandability'
  )),
  score numeric(3, 1) not null check (score >= 0 and score <= 10),
  explanation text not null,
  evidence_kind public.evidence_kind not null default 'inferred_conclusion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, dimension)
);

create index opportunity_scores_opp_idx on public.opportunity_scores (opportunity_id);

create trigger opportunity_scores_updated_at before update on public.opportunity_scores
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Research reports, sources and claims
-- ---------------------------------------------------------------------------
create table public.research_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  brand_id uuid,
  mission_id uuid references public.research_missions (id) on delete set null,
  agent_run_id uuid,
  report_type text not null default 'opportunity' check (report_type in ('opportunity', 'brand_naming', 'trend', 'competitor', 'other')),
  title text not null,
  summary text not null,
  research_mode text not null default 'model_only' check (research_mode in ('live', 'model_only', 'demo', 'manual')),
  -- validated structured snapshot of the agent output that produced the report
  snapshot jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_reports_opp_idx on public.research_reports (opportunity_id, created_at desc);
create index research_reports_brand_idx on public.research_reports (brand_id, created_at desc);

create trigger research_reports_updated_at before update on public.research_reports
  for each row execute function public.set_updated_at();

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  report_id uuid references public.research_reports (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  brand_id uuid,
  trend_id uuid,
  source_type public.source_type not null,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  source_title text,
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz,
  claim text not null,
  quote_snippet text,
  evidence_kind public.evidence_kind not null,
  confidence public.confidence_level not null default 'low',
  -- a sourced fact must point at a URL that was actually retrieved
  constraint research_sources_fact_needs_source check (
    evidence_kind not in ('measured_fact', 'observed_signal') or source_url is not null
  ),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_sources_report_idx on public.research_sources (report_id);
create index research_sources_opp_idx on public.research_sources (opportunity_id);
create index research_sources_trend_idx on public.research_sources (trend_id);

create trigger research_sources_updated_at before update on public.research_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  working_title text not null check (char_length(working_title) between 2 and 200),
  official_name text,
  niche text not null,
  sub_niche text,
  audience text,
  stage public.brand_stage not null default 'idea',
  opportunity_id uuid references public.opportunities (id) on delete set null,
  opportunity_thesis text,
  positioning text,
  tagline text,
  voice text,
  domain text,
  trademark_notes text,
  research_summary text,
  risk_summary text,
  hypotheses jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create index brands_ws_stage_idx on public.brands (workspace_id, stage);
create index brands_title_trgm on public.brands using gin (working_title extensions.gin_trgm_ops);

create trigger brands_code before insert on public.brands
  for each row execute function public.assign_code('PL');
create trigger brands_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.opportunities
  add constraint opportunities_brand_fk foreign key (brand_id) references public.brands (id) on delete set null;
alter table public.research_missions
  add constraint research_missions_brand_fk foreign key (brand_id) references public.brands (id) on delete set null;
alter table public.research_reports
  add constraint research_reports_brand_fk foreign key (brand_id) references public.brands (id) on delete cascade;
alter table public.research_sources
  add constraint research_sources_brand_fk foreign key (brand_id) references public.brands (id) on delete cascade;
alter table public.audit_log
  add constraint audit_log_brand_fk foreign key (brand_id) references public.brands (id) on delete set null;
alter table public.notifications
  add constraint notifications_brand_fk foreign key (brand_id) references public.brands (id) on delete cascade;
alter table public.files
  add constraint files_brand_fk foreign key (brand_id) references public.brands (id) on delete set null;
alter table public.notes
  add constraint notes_brand_fk foreign key (brand_id) references public.brands (id) on delete cascade;

create table public.brand_stage_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  from_stage public.brand_stage,
  to_stage public.brand_stage not null,
  actor_type public.actor_type not null,
  actor_id uuid references public.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_stage_history_brand_idx on public.brand_stage_history (brand_id, created_at desc);

-- Brand decisions (kill / iterate / clone / scale) — human or analyst sourced.
create table public.brand_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  decision text not null check (decision in ('keep_collecting', 'kill', 'iterate', 'clone', 'scale', 'pause', 'revisit')),
  reason text not null,
  source public.actor_type not null default 'human',
  decided_by uuid references public.users (id) on delete set null,
  experiment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_decisions_brand_idx on public.brand_decisions (brand_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Lifecycle state machine (mirrors src/domain/lifecycle.ts — kept in sync by an
-- integration test that compares both implementations for every stage pair).
-- ---------------------------------------------------------------------------
create or replace function public.brand_stage_transition_kind(from_stage public.brand_stage, to_stage public.brand_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  -- returns 'allowed', 'gated' (requires an approval gate), 'resume' (leave 'paused'
  -- back to the pre-pause stage) or 'invalid'
  select case
    when from_stage = to_stage then 'invalid'
    -- gated transitions
    when from_stage = 'candidate' and to_stage = 'approved' then 'gated'
    when from_stage = 'branding' and to_stage = 'creative' then 'gated'
    when from_stage = 'product_selection' and to_stage = 'store_build' then 'gated'
    when from_stage = 'store_build' and to_stage = 'launch_ready' then 'gated'
    when to_stage = 'scaling' and from_stage in ('testing', 'iterating') then 'gated'
    -- universal exits
    when to_stage = 'killed' and from_stage not in ('killed', 'archived') then 'allowed'
    when to_stage = 'archived' then 'allowed'
    when to_stage = 'paused' and from_stage not in ('paused', 'killed', 'archived') then 'allowed'
    -- normal flow
    when from_stage = 'idea' and to_stage = 'researching' then 'allowed'
    when from_stage = 'researching' and to_stage in ('candidate', 'idea') then 'allowed'
    when from_stage = 'candidate' and to_stage = 'researching' then 'allowed'
    when from_stage = 'approved' and to_stage = 'branding' then 'allowed'
    when from_stage = 'creative' and to_stage in ('product_selection', 'branding') then 'allowed'
    when from_stage = 'product_selection' and to_stage = 'creative' then 'allowed'
    when from_stage = 'store_build' and to_stage = 'product_selection' then 'allowed'
    when from_stage = 'launch_ready' and to_stage in ('testing', 'store_build') then 'allowed'
    when from_stage = 'testing' and to_stage = 'iterating' then 'allowed'
    when from_stage = 'iterating' and to_stage in ('testing', 'creative', 'product_selection', 'store_build') then 'allowed'
    when from_stage = 'scaling' and to_stage in ('testing', 'iterating') then 'allowed'
    -- resuming is only valid back into the stage the brand was paused from
    when from_stage = 'paused' and to_stage in (
      'researching', 'candidate', 'approved', 'branding', 'creative', 'product_selection',
      'store_build', 'launch_ready', 'testing', 'iterating', 'scaling'
    ) then 'resume'
    when from_stage in ('killed', 'archived') and to_stage = 'idea' then 'allowed'
    else 'invalid'
  end;
$$;

create or replace function public.enforce_brand_stage_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  kind text;
  prev public.brand_stage;
begin
  if new.stage is distinct from old.stage then
    kind := public.brand_stage_transition_kind(old.stage, new.stage);
    if kind = 'invalid' then
      raise exception 'Invalid brand stage transition % -> %', old.stage, new.stage
        using errcode = 'check_violation';
    end if;
    if kind = 'resume' then
      select h.from_stage into prev
      from public.brand_stage_history h
      where h.brand_id = new.id and h.to_stage = 'paused'
      order by h.created_at desc
      limit 1;
      if prev is distinct from new.stage then
        raise exception 'A paused brand can only resume to its previous stage (%)', coalesce(prev::text, 'unknown')
          using errcode = 'check_violation';
      end if;
    end if;
    if kind = 'gated' and coalesce(current_setting('pod_lab.gate_context', true), '') <> 'on' then
      raise exception 'Brand stage transition % -> % requires an approved gate', old.stage, new.stage
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger brands_stage_transition before update of stage on public.brands
  for each row execute function public.enforce_brand_stage_transition();
