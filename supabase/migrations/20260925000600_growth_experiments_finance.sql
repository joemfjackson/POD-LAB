-- POD Lab — growth campaigns & content, experiments & metrics, decision rules,
-- order imports, financial metrics, trends, insights, import batches.

-- ---------------------------------------------------------------------------
-- Growth
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  platform text not null check (platform in (
    'tiktok', 'instagram', 'facebook', 'pinterest', 'x', 'youtube_shorts', 'reddit',
    'google_search', 'seo', 'email', 'influencer', 'multi'
  )),
  objective text,
  audience text,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected')),
  is_paid boolean not null default false,
  proposed_budget_usd numeric(12, 2) check (proposed_budget_usd is null or proposed_budget_usd >= 0),
  approved_budget_usd numeric(12, 2) check (approved_budget_usd is null or approved_budget_usd >= 0),
  strategy jsonb not null default '{}'::jsonb,
  start_date date,
  end_date date,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  -- paid spend can never be active without an approved budget
  constraint campaigns_paid_needs_budget check (
    not is_paid or status not in ('approved', 'active') or approved_budget_usd is not null
  )
);

create index campaigns_brand_idx on public.campaigns (brand_id, status);

create trigger campaigns_code before insert on public.campaigns
  for each row execute function public.assign_code('CMP');
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  platform text not null,
  content_type text not null check (content_type in (
    'post', 'short_video_script', 'hook', 'caption', 'email', 'influencer_brief',
    'outreach_template', 'ugc_concept', 'landing_page_experiment', 'discount_experiment', 'content_pillar'
  )),
  title text not null,
  body text not null,
  day_offset integer check (day_offset is null or day_offset between 0 and 365),
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_items_brand_idx on public.content_items (brand_id, campaign_id, day_offset);

create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Decision rules (configurable thresholds for the Experiment Analyst)
-- ---------------------------------------------------------------------------
create table public.decision_rule_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  min_sessions integer not null default 500 check (min_sessions >= 0),
  min_impressions integer not null default 5000 check (min_impressions >= 0),
  min_purchases integer not null default 10 check (min_purchases >= 0),
  min_ad_spend_usd numeric(12, 2) not null default 100 check (min_ad_spend_usd >= 0),
  min_days_running integer not null default 7 check (min_days_running >= 0),
  kill_max_conversion_rate numeric(6, 4) not null default 0.005,
  kill_max_ctr numeric(6, 4) not null default 0.004,
  kill_max_contribution_margin numeric(6, 4) not null default -0.10,
  scale_min_roas numeric(8, 3) not null default 2.5,
  scale_min_contribution_margin numeric(6, 4) not null default 0.15,
  scale_min_conversion_rate numeric(6, 4) not null default 0.02,
  clone_min_ctr numeric(6, 4) not null default 0.015,
  iterate_min_ctr numeric(6, 4) not null default 0.008,
  min_lift_for_winner numeric(6, 4) not null default 0.10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index decision_rule_sets_one_default_idx on public.decision_rule_sets (workspace_id) where is_default;

create trigger decision_rule_sets_updated_at before update on public.decision_rule_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Experiments
-- ---------------------------------------------------------------------------
create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  experiment_type text not null check (experiment_type in (
    'brand_name', 'positioning', 'mockup', 'design', 'product', 'price', 'bundle', 'homepage',
    'offer', 'shipping', 'ad_creative', 'audience', 'social_content'
  )),
  hypothesis text not null,
  primary_metric text not null check (primary_metric in (
    'ctr', 'conversion_rate', 'add_to_cart_rate', 'aov', 'roas', 'contribution_margin', 'cac', 'contribution_profit'
  )),
  minimum_sample integer not null default 500 check (minimum_sample >= 0),
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed', 'cancelled')),
  start_date date,
  end_date date,
  decision_rule_set_id uuid references public.decision_rule_sets (id) on delete set null,
  decision text check (decision is null or decision in ('insufficient_data', 'keep_collecting', 'kill', 'iterate', 'clone', 'scale')),
  decision_reasons jsonb not null default '[]'::jsonb,
  decision_details jsonb not null default '{}'::jsonb,
  decided_at timestamptz,
  winning_variant_id uuid,
  override_decision text check (override_decision is null or override_decision in ('insufficient_data', 'keep_collecting', 'kill', 'iterate', 'clone', 'scale')),
  override_reason text,
  overridden_by uuid references public.users (id) on delete set null,
  overridden_at timestamptz,
  campaign_id uuid references public.campaigns (id) on delete set null,
  is_demo boolean not null default false,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  constraint experiments_override_needs_reason check (override_decision is null or char_length(coalesce(override_reason, '')) >= 3),
  constraint experiments_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index experiments_brand_idx on public.experiments (brand_id, status);
create index experiments_ws_status_idx on public.experiments (workspace_id, status);

create trigger experiments_code before insert on public.experiments
  for each row execute function public.assign_code('EXP');
create trigger experiments_updated_at before update on public.experiments
  for each row execute function public.set_updated_at();

create table public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  key text not null check (key ~ '^[A-Z]$'),
  name text not null,
  description text,
  is_control boolean not null default false,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, key)
);

create trigger experiment_variants_updated_at before update on public.experiment_variants
  for each row execute function public.set_updated_at();

alter table public.experiments
  add constraint experiments_winner_fk foreign key (winning_variant_id) references public.experiment_variants (id) on delete set null;
alter table public.brand_decisions
  add constraint brand_decisions_experiment_fk foreign key (experiment_id) references public.experiments (id) on delete set null;

create table public.experiment_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  variant_id uuid not null references public.experiment_variants (id) on delete cascade,
  metric_date date not null,
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  sessions integer not null default 0 check (sessions >= 0),
  product_views integer not null default 0 check (product_views >= 0),
  add_to_carts integer not null default 0 check (add_to_carts >= 0),
  checkouts integer not null default 0 check (checkouts >= 0),
  purchases integer not null default 0 check (purchases >= 0),
  gross_revenue numeric(12, 2) not null default 0 check (gross_revenue >= 0),
  discounts numeric(12, 2) not null default 0 check (discounts >= 0),
  refunds numeric(12, 2) not null default 0 check (refunds >= 0),
  cogs numeric(12, 2) not null default 0 check (cogs >= 0),
  fulfillment_cost numeric(12, 2) not null default 0 check (fulfillment_cost >= 0),
  shipping_subsidy numeric(12, 2) not null default 0 check (shipping_subsidy >= 0),
  ad_spend numeric(12, 2) not null default 0 check (ad_spend >= 0),
  repeat_buyers integer not null default 0 check (repeat_buyers >= 0),
  source text not null default 'manual' check (source in ('manual', 'csv', 'integration', 'demo')),
  import_batch_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, metric_date, source)
);

create index experiment_metrics_exp_idx on public.experiment_metrics (experiment_id, metric_date);

create trigger experiment_metrics_updated_at before update on public.experiment_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imports, orders & financials
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('products', 'orders', 'experiment_metrics', 'fulfillment_catalog')),
  filename text not null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed')),
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  brand_id uuid references public.brands (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index import_batches_ws_idx on public.import_batches (workspace_id, created_at desc);

alter table public.experiment_metrics
  add constraint experiment_metrics_batch_fk foreign key (import_batch_id) references public.import_batches (id) on delete set null;

create table public.orders_import (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  brand_product_id uuid references public.brand_products (id) on delete set null,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  external_order_id text not null,
  order_date date not null,
  channel text,
  sku text,
  product_title text,
  quantity integer not null default 1 check (quantity > 0),
  revenue numeric(12, 2) not null default 0 check (revenue >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  shipping_paid numeric(12, 2) not null default 0 check (shipping_paid >= 0),
  cogs numeric(12, 2) not null default 0 check (cogs >= 0),
  decoration_cost numeric(12, 2) not null default 0 check (decoration_cost >= 0),
  fulfillment_fee numeric(12, 2) not null default 0 check (fulfillment_fee >= 0),
  shipping_cost numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  payment_processing numeric(12, 2) not null default 0 check (payment_processing >= 0),
  platform_fee numeric(12, 2) not null default 0 check (platform_fee >= 0),
  ad_attribution numeric(12, 2) not null default 0 check (ad_attribution >= 0),
  refunds numeric(12, 2) not null default 0 check (refunds >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, external_order_id, sku)
);

create index orders_import_brand_date_idx on public.orders_import (brand_id, order_date);

create table public.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  metric_date date not null,
  orders integer not null default 0,
  units integer not null default 0,
  revenue numeric(12, 2) not null default 0,
  discounts numeric(12, 2) not null default 0,
  net_sales numeric(12, 2) not null default 0,
  cogs numeric(12, 2) not null default 0,
  decoration_cost numeric(12, 2) not null default 0,
  fulfillment_fees numeric(12, 2) not null default 0,
  shipping_paid numeric(12, 2) not null default 0,
  shipping_cost numeric(12, 2) not null default 0,
  shipping_subsidy numeric(12, 2) not null default 0,
  payment_processing numeric(12, 2) not null default 0,
  platform_fees numeric(12, 2) not null default 0,
  ad_spend numeric(12, 2) not null default 0,
  refund_reserve numeric(12, 2) not null default 0,
  refunds numeric(12, 2) not null default 0,
  gross_profit numeric(12, 2) not null default 0,
  contribution_profit numeric(12, 2) not null default 0,
  sessions integer not null default 0,
  source text not null default 'orders_import' check (source in ('orders_import', 'manual', 'demo')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, metric_date, source)
);

create index financial_metrics_ws_date_idx on public.financial_metrics (workspace_id, metric_date);

create trigger financial_metrics_updated_at before update on public.financial_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trends
-- ---------------------------------------------------------------------------
create table public.trends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  name text not null,
  detected_at timestamptz not null default now(),
  category text not null check (category in (
    'emerging_term', 'social', 'hobby', 'profession', 'cultural_shift', 'seasonal',
    'meme', 'product', 'ai_tech', 'aesthetic', 'ecommerce', 'other'
  )),
  summary text,
  velocity text not null default 'unknown' check (velocity in ('spiking', 'rising', 'stable', 'declining', 'unknown')),
  estimated_lifespan text not null default 'unknown' check (estimated_lifespan in ('weeks', 'months', 'seasonal_recurring', 'multi_year', 'evergreen', 'unknown')),
  pod_relevance numeric(3, 1) check (pod_relevance is null or pod_relevance between 0 and 10),
  recommended_action text,
  status text not null default 'new' check (status in ('new', 'watching', 'sent_to_scout', 'dismissed')),
  research_mode text not null default 'model_only' check (research_mode in ('live', 'model_only', 'demo', 'manual')),
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create index trends_ws_idx on public.trends (workspace_id, detected_at desc);

create trigger trends_code before insert on public.trends
  for each row execute function public.assign_code('TRD');
create trigger trends_updated_at before update on public.trends
  for each row execute function public.set_updated_at();

alter table public.research_sources
  add constraint research_sources_trend_fk foreign key (trend_id) references public.trends (id) on delete cascade;
alter table public.research_missions
  add constraint research_missions_trend_fk foreign key (trend_id) references public.trends (id) on delete set null;

create table public.trend_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trend_id uuid not null references public.trends (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trend_id, opportunity_id)
);

-- ---------------------------------------------------------------------------
-- Insights (institutional knowledge)
-- ---------------------------------------------------------------------------
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  title text not null check (char_length(title) between 3 and 300),
  body text not null,
  source public.actor_type not null default 'human',
  -- 'observation' and 'correlation' make no causal claim; 'validated' requires a completed experiment.
  claim_type text not null default 'observation' check (claim_type in ('observation', 'correlation', 'hypothesis', 'validated')),
  confidence public.confidence_level not null default 'low',
  evidence_summary text,
  sample_size integer check (sample_size is null or sample_size >= 0),
  brand_id uuid references public.brands (id) on delete set null,
  experiment_id uuid references public.experiments (id) on delete set null,
  brand_product_id uuid references public.brand_products (id) on delete set null,
  design_id uuid references public.design_concepts (id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.users (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  constraint insights_validated_needs_experiment check (claim_type <> 'validated' or experiment_id is not null)
);

create index insights_ws_idx on public.insights (workspace_id, created_at desc);

create trigger insights_code before insert on public.insights
  for each row execute function public.assign_code('INS');
create trigger insights_updated_at before update on public.insights
  for each row execute function public.set_updated_at();
