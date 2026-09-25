-- POD Lab — brand identity, naming, domains/handles, collections, design system, compliance.

create type public.name_status as enum ('hypothesis', 'proposed', 'shortlisted', 'rejected', 'final');
create type public.availability_status as enum ('unknown', 'unverified', 'likely_available', 'taken', 'error');
create type public.design_status as enum (
  'idea', 'brief', 'generating', 'review', 'revision', 'approved', 'production_ready', 'retired'
);
create type public.compliance_status as enum ('not_reviewed', 'pending', 'clear', 'flagged', 'overridden', 'rejected');

-- ---------------------------------------------------------------------------
-- Brand names
-- ---------------------------------------------------------------------------
create table public.brand_names (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  rationale text not null default '',
  memorability numeric(3, 1) check (memorability is null or memorability between 0 and 10),
  spelling_risk public.risk_level not null default 'low',
  pronunciation_risk public.risk_level not null default 'low',
  collision_notes text,
  trademark_notes text,
  trademark_risk public.risk_level not null default 'medium',
  expansion_potential numeric(3, 1) check (expansion_potential is null or expansion_potential between 0 and 10),
  visual_potential numeric(3, 1) check (visual_potential is null or visual_potential between 0 and 10),
  status public.name_status not null default 'proposed',
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index brand_names_brand_idx on public.brand_names (brand_id, status);
create unique index brand_names_one_final_idx on public.brand_names (brand_id) where status = 'final';

create trigger brand_names_updated_at before update on public.brand_names
  for each row execute function public.set_updated_at();

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  brand_name_id uuid references public.brand_names (id) on delete cascade,
  domain text not null check (domain ~* '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$'),
  availability public.availability_status not null default 'unverified',
  checked_at timestamptz,
  check_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, domain)
);

create trigger domains_updated_at before update on public.domains
  for each row execute function public.set_updated_at();

create table public.social_handles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  brand_name_id uuid references public.brand_names (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'x', 'facebook', 'pinterest', 'youtube', 'reddit', 'threads')),
  handle text not null check (handle ~ '^[A-Za-z0-9._]{1,40}$'),
  availability public.availability_status not null default 'unverified',
  checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, platform, handle)
);

create trigger social_handles_updated_at before update on public.social_handles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Brand identity (versioned; exactly one final at a time)
-- ---------------------------------------------------------------------------
create table public.brand_identity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'final', 'superseded', 'rejected')),
  audience text not null,
  positioning text not null,
  archetype text,
  emotional_appeal text,
  tagline text,
  tagline_candidates text[] not null default '{}',
  brand_story text,
  tone_of_voice text,
  visual_territory text,
  colors jsonb not null default '[]'::jsonb,
  fonts jsonb not null default '[]'::jsonb,
  product_collection_ideas text[] not null default '{}',
  expansion_paths text[] not null default '{}',
  anti_positioning text[] not null default '{}',
  -- Creative Director visual directions (array of 3 structured directions)
  visual_directions jsonb not null default '[]'::jsonb,
  selected_direction text,
  logo_file_id uuid references public.files (id) on delete set null,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, version)
);

create unique index brand_identity_one_final_idx on public.brand_identity (brand_id) where status = 'final';

create trigger brand_identity_updated_at before update on public.brand_identity
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text,
  theme text,
  status text not null default 'active' check (status in ('concept', 'active', 'retired')),
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Design concepts, assets, revisions
-- ---------------------------------------------------------------------------
create table public.design_concepts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  brand_id uuid not null references public.brands (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  parent_design_id uuid references public.design_concepts (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  concept text not null,
  front_placement text,
  back_placement text,
  sleeve_placement text,
  colors text[] not null default '{}',
  typography text,
  illustration_notes text,
  printing_method text check (printing_method is null or printing_method in (
    'dtg', 'dtf', 'screen_print', 'embroidery', 'puff_embroidery', 'liquid_3d', 'sublimation', 'vinyl', 'other'
  )),
  embroidery_suitability numeric(3, 1) check (embroidery_suitability is null or embroidery_suitability between 0 and 10),
  liquid_3d_suitability numeric(3, 1) check (liquid_3d_suitability is null or liquid_3d_suitability between 0 and 10),
  preferred_products text[] not null default '{}',
  target_buyer text,
  generation_prompt text,
  mockup_prompt text,
  visual_direction text,
  status public.design_status not null default 'idea',
  compliance_status public.compliance_status not null default 'not_reviewed',
  current_revision integer not null default 1,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create index design_concepts_brand_idx on public.design_concepts (brand_id, status);
create index design_concepts_ws_status_idx on public.design_concepts (workspace_id, status);
create index design_concepts_title_trgm on public.design_concepts using gin (title extensions.gin_trgm_ops);

create trigger design_concepts_code before insert on public.design_concepts
  for each row execute function public.assign_code('DES');
create trigger design_concepts_updated_at before update on public.design_concepts
  for each row execute function public.set_updated_at();

-- A design can only become production-ready when compliance is clear or overridden.
create or replace function public.enforce_design_production_compliance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'production_ready' and new.compliance_status not in ('clear', 'overridden') then
    raise exception 'Design % cannot be production ready until compliance is clear or overridden', new.code
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger design_concepts_production_guard before insert or update of status, compliance_status on public.design_concepts
  for each row execute function public.enforce_design_production_compliance();

create table public.design_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  design_id uuid not null references public.design_concepts (id) on delete cascade,
  file_id uuid references public.files (id) on delete cascade,
  kind text not null check (kind in ('artwork', 'mockup', 'reference')),
  source text not null default 'upload' check (source in ('upload', 'generated', 'provider')),
  provider text,
  prompt text,
  revision integer not null default 1,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index design_assets_design_idx on public.design_assets (design_id);

create table public.design_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  design_id uuid not null references public.design_concepts (id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  change_notes text,
  actor_type public.actor_type not null,
  actor_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (design_id, revision_number)
);

-- ---------------------------------------------------------------------------
-- Compliance reviews (automated screening — never legal advice)
-- ---------------------------------------------------------------------------
create table public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  subject_type text not null check (subject_type in ('design', 'brand_name', 'collection', 'product', 'content')),
  subject_id uuid not null,
  design_id uuid references public.design_concepts (id) on delete cascade,
  status public.compliance_status not null default 'pending',
  risk_level public.risk_level not null default 'none',
  summary text,
  screening_method text not null default 'rules' check (screening_method in ('rules', 'rules_and_ai', 'manual')),
  human_override boolean not null default false,
  override_notes text,
  overridden_by uuid references public.users (id) on delete set null,
  overridden_at timestamptz,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  disclaimer text not null default 'Automated screening only. This is not legal advice and is not a trademark or copyright clearance.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index compliance_reviews_subject_idx on public.compliance_reviews (subject_type, subject_id, created_at desc);
create index compliance_reviews_ws_status_idx on public.compliance_reviews (workspace_id, status);

create trigger compliance_reviews_updated_at before update on public.compliance_reviews
  for each row execute function public.set_updated_at();

create table public.compliance_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  review_id uuid not null references public.compliance_reviews (id) on delete cascade,
  category text not null check (category in (
    'trademarked_phrase', 'company_name', 'sports_team', 'team_logo', 'copyrighted_character',
    'celebrity', 'protected_lyrics', 'movie_tv_reference', 'copied_artwork', 'brand_confusion',
    'political_campaign_mark', 'restricted_content', 'other'
  )),
  detected_issue text not null,
  matched_term text,
  risk_level public.risk_level not null,
  explanation text not null,
  evidence text,
  action_required text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index compliance_issues_review_idx on public.compliance_issues (review_id);
