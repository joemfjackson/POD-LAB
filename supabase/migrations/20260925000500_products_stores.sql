-- POD Lab — fulfillment providers, catalog, pricing, brand assortment, bundles, stores.

create table public.fulfillment_providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  adapter text not null check (adapter in ('manual', 'csv', 'mock', 'fulfill_engine')),
  status text not null default 'not_configured' check (status in ('active', 'not_configured', 'disabled')),
  -- non-secret settings only (base URL, account id, etc.)
  config jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key)
);

create trigger fulfillment_providers_updated_at before update on public.fulfillment_providers
  for each row execute function public.set_updated_at();

create table public.provider_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_id uuid not null references public.fulfillment_providers (id) on delete cascade,
  provider_sku text not null,
  blank_name text not null,
  blank_brand text,
  product_type text not null check (product_type in (
    'tee', 'long_sleeve', 'hoodie', 'crewneck', 'hat', 'beanie', 'tote', 'mug', 'poster',
    'sticker', 'phone_case', 'jacket', 'shorts', 'other'
  )),
  available_colors text[] not null default '{}',
  available_sizes text[] not null default '{}',
  blank_cost numeric(10, 2) not null check (blank_cost >= 0),
  decoration_method text not null default 'dtg',
  decoration_cost numeric(10, 2) not null default 0 check (decoration_cost >= 0),
  fulfillment_fee numeric(10, 2) not null default 0 check (fulfillment_fee >= 0),
  shipping_estimate_domestic numeric(10, 2) check (shipping_estimate_domestic is null or shipping_estimate_domestic >= 0),
  shipping_estimate_international numeric(10, 2) check (shipping_estimate_international is null or shipping_estimate_international >= 0),
  production_sla_days integer check (production_sla_days is null or production_sla_days between 0 and 90),
  product_images text[] not null default '{}',
  inventory_mode text not null default 'print_on_demand' check (inventory_mode in ('print_on_demand', 'stocked', 'hybrid')),
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'manual' check (source in ('manual', 'csv', 'mock', 'provider_api')),
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, provider_sku)
);

create index provider_products_ws_idx on public.provider_products (workspace_id, product_type);
create index provider_products_name_trgm on public.provider_products using gin (blank_name extensions.gin_trgm_ops);

create trigger provider_products_updated_at before update on public.provider_products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_product_id uuid not null references public.provider_products (id) on delete cascade,
  variant_sku text not null,
  color text,
  size text,
  blank_cost_override numeric(10, 2) check (blank_cost_override is null or blank_cost_override >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_product_id, variant_sku)
);

create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Pricing models (fee assumptions used by the Profit agent)
-- ---------------------------------------------------------------------------
create table public.pricing_models (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  payment_processing_pct numeric(6, 4) not null default 0.029 check (payment_processing_pct between 0 and 0.5),
  payment_processing_fixed numeric(10, 2) not null default 0.30 check (payment_processing_fixed >= 0),
  platform_fee_pct numeric(6, 4) not null default 0.0 check (platform_fee_pct between 0 and 0.5),
  shipping_charged numeric(10, 2) not null default 4.99 check (shipping_charged >= 0),
  free_shipping_threshold numeric(10, 2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  refund_reserve_pct numeric(6, 4) not null default 0.03 check (refund_reserve_pct between 0 and 0.5),
  target_cac numeric(10, 2) not null default 0 check (target_cac >= 0),
  target_contribution_margin numeric(6, 4) not null default 0.25 check (target_contribution_margin between -1 and 1),
  min_gross_margin numeric(6, 4) not null default 0.40 check (min_gross_margin between -1 and 1),
  quantity_discounts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pricing_models_one_default_idx on public.pricing_models (workspace_id) where is_default and brand_id is null;

create trigger pricing_models_updated_at before update on public.pricing_models
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Brand assortment
-- ---------------------------------------------------------------------------
create table public.brand_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  brand_id uuid not null references public.brands (id) on delete cascade,
  provider_product_id uuid not null references public.provider_products (id) on delete restrict,
  design_id uuid references public.design_concepts (id) on delete set null,
  collection_id uuid references public.collections (id) on delete set null,
  pricing_model_id uuid references public.pricing_models (id) on delete set null,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text,
  status text not null default 'candidate' check (status in ('candidate', 'pending_approval', 'approved', 'rejected', 'retired')),
  retail_price numeric(10, 2) not null check (retail_price > 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price > 0),
  promo_price numeric(10, 2) check (promo_price is null or promo_price > 0),
  promo_ends_at timestamptz,
  recommendation text check (recommendation is null or recommendation in ('launch', 'avoid', 'premium_only', 'bundle_only', 'upsell', 'test')),
  recommendation_reason text,
  -- last computed unit economics snapshot (see src/domain/finance.ts)
  economics jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code),
  unique (brand_id, slug)
);

create index brand_products_brand_idx on public.brand_products (brand_id, status);
create index brand_products_title_trgm on public.brand_products using gin (title extensions.gin_trgm_ops);

create trigger brand_products_code before insert on public.brand_products
  for each row execute function public.assign_code('PRD');
create trigger brand_products_updated_at before update on public.brand_products
  for each row execute function public.set_updated_at();

create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  description text,
  bundle_price numeric(10, 2) not null check (bundle_price > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bundles_updated_at before update on public.bundles
  for each row execute function public.set_updated_at();

create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  bundle_id uuid not null references public.bundles (id) on delete cascade,
  brand_product_id uuid not null references public.brand_products (id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bundle_id, brand_product_id)
);

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code text not null default '' check (code <> ''),
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'pending_launch_approval', 'launch_approved', 'live', 'paused', 'archived')),
  provider text not null default 'internal_preview' check (provider in ('internal_preview', 'generic_export', 'shopify', 'fulfill_engine', 'nextjs')),
  version integer not null default 1,
  theme jsonb not null default '{}'::jsonb,
  navigation jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  announcement text,
  cart_strategy jsonb not null default '{}'::jsonb,
  email_capture jsonb not null default '{}'::jsonb,
  domain text,
  external_id text,
  launch_approved_at timestamptz,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, code)
);

create index stores_brand_idx on public.stores (brand_id);

create trigger stores_code before insert on public.stores
  for each row execute function public.assign_code('STR');
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

create table public.store_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  page_type text not null check (page_type in (
    'home', 'about', 'contact', 'faq', 'shipping', 'returns', 'privacy', 'terms', 'size_guide'
  )),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  title text not null,
  seo_title text,
  seo_description text,
  -- ordered list of typed sections rendered by the storefront preview
  sections jsonb not null default '[]'::jsonb,
  is_placeholder boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create trigger store_pages_updated_at before update on public.store_pages
  for each row execute function public.set_updated_at();

create table public.store_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text,
  seo_title text,
  seo_description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create trigger store_collections_updated_at before update on public.store_collections
  for each row execute function public.set_updated_at();

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  brand_product_id uuid not null references public.brand_products (id) on delete cascade,
  store_collection_id uuid references public.store_collections (id) on delete set null,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  description text not null default '',
  bullet_points text[] not null default '{}',
  seo_title text,
  seo_description text,
  price numeric(10, 2) not null check (price > 0),
  compare_at_price numeric(10, 2),
  badges text[] not null default '{}',
  upsell_product_ids uuid[] not null default '{}',
  cross_sell_product_ids uuid[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create trigger store_products_updated_at before update on public.store_products
  for each row execute function public.set_updated_at();
