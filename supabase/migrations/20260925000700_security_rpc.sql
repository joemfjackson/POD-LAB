-- POD Lab — row level security, gated-status guards, approval decision RPC,
-- storage bucket & policies, search and dashboard functions.

-- ---------------------------------------------------------------------------
-- updated_at triggers for any table that has the column but no trigger yet
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tg
        join pg_class cl on cl.oid = tg.tgrelid
        join pg_namespace ns on ns.oid = cl.relnamespace
        where ns.nspname = 'public' and cl.relname = c.table_name and tg.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.id_counters enable row level security;
alter table public.rate_limits enable row level security;
alter table public.provider_credentials enable row level security;
-- id_counters, rate_limits and provider_credentials intentionally have no
-- policies: they are only reachable through security-definer functions or the
-- server-side service role.

create policy users_select on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = (select auth.uid()) and b.user_id = public.users.id
    )
  );
create policy users_update on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, 'admin')) with check (public.has_workspace_role(id, 'admin'));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (public.has_workspace_role(id, 'owner'));

create policy workspace_members_select on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy workspace_members_insert on public.workspace_members for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'admin') and role <> 'owner');
create policy workspace_members_update on public.workspace_members for update to authenticated
  using (public.has_workspace_role(workspace_id, 'admin') and role <> 'owner')
  with check (public.has_workspace_role(workspace_id, 'admin') and role <> 'owner');
create policy workspace_members_delete on public.workspace_members for delete to authenticated
  using (public.has_workspace_role(workspace_id, 'admin') and role <> 'owner');

-- Standard workspace-scoped tables: members read, editors write, admins delete.
do $$
declare
  t text;
begin
  foreach t in array array[
    'research_missions', 'opportunities', 'opportunity_scores', 'research_reports', 'research_sources',
    'brands', 'brand_decisions', 'brand_names', 'domains', 'social_handles', 'brand_identity',
    'collections', 'design_concepts', 'design_assets', 'design_revisions', 'compliance_reviews',
    'compliance_issues', 'provider_products', 'product_variants', 'brand_products', 'bundles',
    'bundle_items', 'stores', 'store_pages', 'store_collections', 'store_products', 'campaigns',
    'content_items', 'experiments', 'experiment_variants', 'experiment_metrics', 'import_batches',
    'orders_import', 'financial_metrics', 'trends', 'trend_opportunities', 'insights', 'files', 'notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id, ''editor''))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id, ''editor'')) with check (public.has_workspace_role(workspace_id, ''editor''))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id, ''admin''))',
      t || '_delete', t);
  end loop;
end;
$$;

-- Admin-managed configuration tables.
do $$
declare
  t text;
begin
  foreach t in array array['agents', 'fulfillment_providers', 'pricing_models', 'decision_rule_sets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_workspace_role(workspace_id, ''admin''))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_workspace_role(workspace_id, ''admin'')) with check (public.has_workspace_role(workspace_id, ''admin''))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_workspace_role(workspace_id, ''admin''))',
      t || '_delete', t);
  end loop;
end;
$$;

-- Stage history is append-only.
alter table public.brand_stage_history enable row level security;
create policy brand_stage_history_select on public.brand_stage_history for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy brand_stage_history_insert on public.brand_stage_history for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, 'editor')
    and actor_type = 'human' and actor_id = (select auth.uid())
  );

-- Audit log is append-only; humans can only write entries attributed to themselves.
alter table public.audit_log enable row level security;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, 'viewer')
    and actor_type = 'human' and actor_id = (select auth.uid())
  );

-- Jobs: editors enqueue and cancel; execution state is written server-side.
alter table public.agent_jobs enable row level security;
create policy agent_jobs_select on public.agent_jobs for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy agent_jobs_insert on public.agent_jobs for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, 'editor')
    and status = 'queued' and attempts = 0
    and requested_by = (select auth.uid()) and requested_by_actor = 'human'
  );

alter table public.agent_runs enable row level security;
create policy agent_runs_select on public.agent_runs for select to authenticated
  using (public.is_workspace_member(workspace_id));

alter table public.agent_outputs enable row level security;
create policy agent_outputs_select on public.agent_outputs for select to authenticated
  using (public.is_workspace_member(workspace_id));

-- Gates: anyone with editor can request; decisions only via decide_approval_gate().
alter table public.approval_gates enable row level security;
create policy approval_gates_select on public.approval_gates for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy approval_gates_insert on public.approval_gates for insert to authenticated
  with check (
    public.has_workspace_role(workspace_id, 'editor')
    and status = 'pending' and decided_by is null and decided_at is null
    and requested_by = (select auth.uid()) and requested_by_actor = 'human'
  );

alter table public.approval_comments enable row level security;
create policy approval_comments_select on public.approval_comments for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy approval_comments_insert on public.approval_comments for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'viewer') and author_id = (select auth.uid()));

alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated
  using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.has_workspace_role(workspace_id, 'editor') and (user_id is null or user_id = (select auth.uid())));
create policy notifications_update on public.notifications for update to authenticated
  using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = (select auth.uid())))
  with check (public.is_workspace_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Gated-value guards: approvals can only be granted inside decide_approval_gate().
-- ---------------------------------------------------------------------------
create or replace function public.in_gate_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('pod_lab.gate_context', true), '') = 'on';
$$;

-- Generic guard: TG_ARGV[0] = column name, TG_ARGV[1..] = values that require a gate.
create or replace function public.guard_gated_value()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text := tg_argv[0];
  new_v text := to_jsonb(new) ->> col;
  old_v text;
begin
  if tg_op = 'UPDATE' then
    old_v := to_jsonb(old) ->> col;
  end if;
  if new_v is distinct from old_v
     and new_v = any (tg_argv[1:array_length(tg_argv, 1) - 1])
     and not public.in_gate_context() then
    raise exception '%.% = % requires human approval through an approval gate', tg_table_name, col, new_v
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger opportunities_gate_guard before insert or update of status on public.opportunities
  for each row execute function public.guard_gated_value('status', 'approved');
create trigger brand_names_gate_guard before insert or update of status on public.brand_names
  for each row execute function public.guard_gated_value('status', 'final');
create trigger brand_identity_gate_guard before insert or update of status on public.brand_identity
  for each row execute function public.guard_gated_value('status', 'final');
create trigger brand_products_gate_guard before insert or update of status on public.brand_products
  for each row execute function public.guard_gated_value('status', 'approved');
create trigger stores_gate_guard before insert or update of status on public.stores
  for each row execute function public.guard_gated_value('status', 'launch_approved');
create trigger compliance_reviews_gate_guard before insert or update of status on public.compliance_reviews
  for each row execute function public.guard_gated_value('status', 'overridden');
create trigger provider_credentials_gate_guard before insert or update of status on public.provider_credentials
  for each row execute function public.guard_gated_value('status', 'active');

create or replace function public.guard_store_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'live' and old.status is distinct from 'live'
     and old.status <> 'launch_approved' and not public.in_gate_context() then
    raise exception 'A store can only go live after launch approval' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger stores_live_guard before update of status on public.stores
  for each row execute function public.guard_store_live();

create or replace function public.guard_design_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.status is distinct from old.status)
     and new.status in ('approved', 'production_ready')
     and not public.in_gate_context()
     -- a design approved before compliance cleared may advance once compliance is clear
     and not (tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'production_ready'
              and new.compliance_status in ('clear', 'overridden')) then
    raise exception 'Design status % requires the design production approval gate', new.status
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and new.compliance_status is distinct from old.compliance_status
     and new.compliance_status = 'overridden' and not public.in_gate_context() then
    raise exception 'Compliance overrides require the compliance override gate' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger design_concepts_gate_guard before insert or update of status, compliance_status on public.design_concepts
  for each row execute function public.guard_design_status();

create or replace function public.guard_campaign_spend()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_paid and not public.in_gate_context() then
    if new.status in ('approved', 'active') and (tg_op = 'INSERT' or old.status not in ('approved', 'active', 'paused')) then
      raise exception 'Paid campaigns require the paid campaign spending approval gate' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and new.approved_budget_usd is distinct from old.approved_budget_usd then
      raise exception 'Approved budgets can only change through an approval gate' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if tg_op = 'INSERT' and new.approved_budget_usd is not null and not public.in_gate_context() then
    raise exception 'Approved budgets can only be set through an approval gate' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger campaigns_gate_guard before insert or update on public.campaigns
  for each row execute function public.guard_campaign_spend();

-- ---------------------------------------------------------------------------
-- Stage transition helper used by the gate RPC (inside gate context)
-- ---------------------------------------------------------------------------
create or replace function public.gate_move_brand(p_brand uuid, p_to public.brand_stage, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.brands%rowtype;
begin
  select * into b from public.brands where id = p_brand for update;
  if not found or b.stage = p_to then
    return;
  end if;
  update public.brands set stage = p_to where id = p_brand;
  insert into public.brand_stage_history (workspace_id, brand_id, from_stage, to_stage, actor_type, actor_id, reason)
  values (b.workspace_id, p_brand, b.stage, p_to, 'human', (select auth.uid()), p_reason);
end;
$$;

revoke execute on function public.gate_move_brand(uuid, public.brand_stage, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- decide_approval_gate: the ONLY way to approve/reject a gate. Human-only,
-- role-checked per gate type, applies side effects atomically and audits.
-- ---------------------------------------------------------------------------
create or replace function public.decide_approval_gate(
  p_gate_id uuid,
  p_decision public.approval_status,
  p_reason text default null
)
returns public.approval_gates
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.approval_gates%rowtype;
  uid uuid := (select auth.uid());
  opp public.opportunities%rowtype;
  v_brand uuid;
  v_stage public.brand_stage;
  v_name public.brand_names%rowtype;
  v_ident public.brand_identity%rowtype;
  v_design public.design_concepts%rowtype;
  v_review public.compliance_reviews%rowtype;
  v_camp public.campaigns%rowtype;
  v_cred public.provider_credentials%rowtype;
  v_ids uuid[];
  v_action text;
begin
  if uid is null then
    raise exception 'Approval decisions require an authenticated human user' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('approved', 'rejected', 'revision_requested') then
    raise exception 'Invalid decision %', p_decision using errcode = 'invalid_parameter_value';
  end if;

  select * into g from public.approval_gates where id = p_gate_id for update;
  if not found then
    raise exception 'Approval gate not found' using errcode = 'no_data_found';
  end if;
  if not public.has_workspace_role(g.workspace_id, public.gate_min_role(g.gate_type)) then
    raise exception 'Your role cannot decide % gates', g.gate_type using errcode = 'insufficient_privilege';
  end if;
  if g.status <> 'pending' then
    raise exception 'Approval gate % is already %', g.code, g.status using errcode = 'check_violation';
  end if;
  if p_decision in ('rejected', 'revision_requested') and char_length(coalesce(trim(p_reason), '')) < 3 then
    raise exception 'A reason is required to reject or request revision' using errcode = 'invalid_parameter_value';
  end if;

  perform set_config('pod_lab.gate_context', 'on', true);

  update public.approval_gates
     set status = p_decision, decided_by = uid, decided_at = now(), decision_reason = nullif(trim(p_reason), '')
   where id = g.id
   returning * into g;

  case g.gate_type
  -- ------------------------------------------------------------------ opportunity
  when 'opportunity_approval' then
    select * into opp from public.opportunities where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.opportunities set status = 'approved' where id = opp.id;
      v_brand := opp.brand_id;
      if v_brand is null then
        insert into public.brands (
          workspace_id, working_title, niche, audience, stage, opportunity_id, opportunity_thesis,
          research_summary, risk_summary, is_demo, created_by
        ) values (
          opp.workspace_id, opp.niche, opp.niche, opp.audience, 'approved', opp.id, opp.hypothesis,
          opp.summary, opp.biggest_risk, opp.is_demo, uid
        ) returning id into v_brand;
        insert into public.brand_stage_history (workspace_id, brand_id, from_stage, to_stage, actor_type, actor_id, reason)
        values (opp.workspace_id, v_brand, null, 'approved', 'human', uid, 'Created from approved opportunity ' || opp.code);
        update public.opportunities set brand_id = v_brand where id = opp.id;
      else
        select stage into v_stage from public.brands where id = v_brand;
        if v_stage = 'idea' then
          perform public.gate_move_brand(v_brand, 'researching', 'Opportunity approved');
          v_stage := 'researching';
        end if;
        if v_stage = 'researching' then
          perform public.gate_move_brand(v_brand, 'candidate', 'Opportunity approved');
          v_stage := 'candidate';
        end if;
        if v_stage = 'candidate' then
          perform public.gate_move_brand(v_brand, 'approved', 'Opportunity ' || opp.code || ' approved');
        end if;
        update public.brands
           set opportunity_thesis = coalesce(opportunity_thesis, opp.hypothesis),
               research_summary = coalesce(opp.summary, research_summary),
               risk_summary = coalesce(opp.biggest_risk, risk_summary)
         where id = v_brand;
      end if;
      g.brand_id := v_brand;
      update public.approval_gates set brand_id = v_brand where id = g.id;
    elsif p_decision = 'rejected' then
      update public.opportunities set status = 'rejected', rejected_reason = p_reason where id = opp.id;
    else
      update public.opportunities set status = 'researching' where id = opp.id;
    end if;

  -- ------------------------------------------------------------------ brand name
  when 'brand_name_final' then
    select * into v_name from public.brand_names where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.brand_names set status = 'shortlisted' where brand_id = v_name.brand_id and status = 'final';
      update public.brand_names set status = 'final' where id = v_name.id;
      update public.brands set official_name = v_name.name where id = v_name.brand_id;
    elsif p_decision = 'rejected' then
      update public.brand_names set status = 'rejected' where id = v_name.id;
    else
      update public.brand_names set status = 'proposed' where id = v_name.id;
    end if;

  -- ------------------------------------------------------------------ identity
  when 'brand_identity_final' then
    select * into v_ident from public.brand_identity where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.brand_identity set status = 'superseded' where brand_id = v_ident.brand_id and status = 'final';
      update public.brand_identity set status = 'final' where id = v_ident.id;
      update public.brands
         set positioning = v_ident.positioning,
             tagline = coalesce(v_ident.tagline, tagline),
             voice = coalesce(v_ident.tone_of_voice, voice),
             audience = v_ident.audience
       where id = v_ident.brand_id;
      select stage into v_stage from public.brands where id = v_ident.brand_id;
      if v_stage = 'approved' then
        perform public.gate_move_brand(v_ident.brand_id, 'branding', 'Brand identity approved');
        v_stage := 'branding';
      end if;
      if v_stage = 'branding' then
        perform public.gate_move_brand(v_ident.brand_id, 'creative', 'Brand identity v' || v_ident.version || ' approved as final');
      end if;
    elsif p_decision = 'rejected' then
      update public.brand_identity set status = 'rejected' where id = v_ident.id;
    else
      update public.brand_identity set status = 'draft' where id = v_ident.id;
    end if;

  -- ------------------------------------------------------------------ design
  when 'design_production' then
    select * into v_design from public.design_concepts where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.design_concepts
         set status = case when compliance_status in ('clear', 'overridden') then 'production_ready'::public.design_status
                           else 'approved'::public.design_status end
       where id = v_design.id;
    elsif p_decision = 'rejected' then
      update public.design_concepts set status = 'retired' where id = v_design.id;
    else
      update public.design_concepts set status = 'revision' where id = v_design.id;
    end if;

  -- ------------------------------------------------------------------ compliance
  when 'compliance_override' then
    select * into v_review from public.compliance_reviews where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.compliance_reviews
         set status = 'overridden', human_override = true, override_notes = coalesce(nullif(trim(p_reason), ''), 'Override approved'),
             overridden_by = uid, overridden_at = now()
       where id = v_review.id;
      if v_review.design_id is not null then
        update public.design_concepts
           set compliance_status = 'overridden',
               status = case when status = 'approved' then 'production_ready'::public.design_status else status end
         where id = v_review.design_id;
      end if;
    elsif p_decision = 'rejected' then
      update public.compliance_reviews set status = 'rejected' where id = v_review.id;
      if v_review.design_id is not null then
        update public.design_concepts set compliance_status = 'rejected', status = 'revision' where id = v_review.design_id;
      end if;
    else
      if v_review.design_id is not null then
        update public.design_concepts set status = 'revision' where id = v_review.design_id;
      end if;
    end if;

  -- ------------------------------------------------------------------ assortment
  when 'product_assortment' then
    select coalesce(array_agg(x::uuid), '{}') into v_ids
      from jsonb_array_elements_text(coalesce(g.payload -> 'brand_product_ids', '[]'::jsonb)) as x;
    if p_decision = 'approved' then
      update public.brand_products set status = 'approved'
       where brand_id = g.subject_id and id = any (v_ids) and status in ('candidate', 'pending_approval');
      update public.brand_products set status = 'candidate'
       where brand_id = g.subject_id and status = 'pending_approval';
      select stage into v_stage from public.brands where id = g.subject_id;
      if v_stage = 'creative' then
        perform public.gate_move_brand(g.subject_id, 'product_selection', 'Product assortment approved');
        v_stage := 'product_selection';
      end if;
      if v_stage = 'product_selection' then
        perform public.gate_move_brand(g.subject_id, 'store_build', 'Product assortment approved');
      end if;
    else
      update public.brand_products set status = 'candidate'
       where brand_id = g.subject_id and status = 'pending_approval';
    end if;

  -- ------------------------------------------------------------------ store
  when 'store_launch' then
    if p_decision = 'approved' then
      update public.stores set status = 'launch_approved', launch_approved_at = now() where id = g.subject_id
      returning brand_id into v_brand;
      select stage into v_stage from public.brands where id = v_brand;
      if v_stage = 'store_build' then
        perform public.gate_move_brand(v_brand, 'launch_ready', 'Store launch approved');
      end if;
    else
      update public.stores set status = 'generated' where id = g.subject_id;
    end if;

  -- ------------------------------------------------------------------ paid spend
  when 'paid_campaign_spend' then
    select * into v_camp from public.campaigns where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.campaigns
         set status = 'approved',
             approved_budget_usd = coalesce((g.payload ->> 'budget_usd')::numeric, v_camp.proposed_budget_usd, 0)
       where id = v_camp.id;
    elsif p_decision = 'rejected' then
      update public.campaigns set status = 'rejected' where id = v_camp.id;
    else
      update public.campaigns set status = 'draft' where id = v_camp.id;
    end if;

  -- ------------------------------------------------------------------ scale
  when 'scale_approval' then
    if p_decision = 'approved' then
      perform public.gate_move_brand(g.subject_id, 'scaling', coalesce(nullif(trim(p_reason), ''), 'Scale approved'));
      insert into public.brand_decisions (workspace_id, brand_id, decision, reason, source, decided_by, experiment_id)
      values (g.workspace_id, g.subject_id, 'scale', coalesce(nullif(trim(p_reason), ''), 'Scale recommendation approved'), 'human', uid,
              nullif(g.payload ->> 'experiment_id', '')::uuid);
    else
      insert into public.brand_decisions (workspace_id, brand_id, decision, reason, source, decided_by, experiment_id)
      values (g.workspace_id, g.subject_id, 'keep_collecting', 'Scale declined: ' || p_reason, 'human', uid,
              nullif(g.payload ->> 'experiment_id', '')::uuid);
    end if;

  -- ------------------------------------------------------------------ credentials
  when 'provider_credentials' then
    select * into v_cred from public.provider_credentials where id = g.subject_id for update;
    if p_decision = 'approved' then
      update public.provider_credentials set status = 'revoked'
       where workspace_id = v_cred.workspace_id and provider_kind = v_cred.provider_kind
         and provider_key = v_cred.provider_key and status = 'active';
      update public.provider_credentials set status = 'active' where id = v_cred.id;
    else
      update public.provider_credentials set status = 'rejected' where id = v_cred.id;
    end if;

  -- ------------------------------------------------------------------ destructive
  when 'destructive_action' then
    v_action := g.payload ->> 'action';
    if p_decision = 'approved' then
      if v_action = 'archive_brand' then
        perform public.gate_move_brand(g.subject_id, 'archived', coalesce(nullif(trim(p_reason), ''), 'Archive approved'));
      elsif v_action = 'delete_brand' then
        delete from public.brands where id = g.subject_id and workspace_id = g.workspace_id;
      else
        raise exception 'Unsupported destructive action %', v_action using errcode = 'invalid_parameter_value';
      end if;
    end if;
  end case;

  insert into public.audit_log (workspace_id, actor_type, actor_id, action, subject_type, subject_id, brand_id, summary, metadata)
  values (
    g.workspace_id, 'human', uid, 'approval.' || p_decision::text, g.subject_type, g.subject_id,
    case when g.gate_type = 'destructive_action' and v_action = 'delete_brand' and p_decision = 'approved' then null else g.brand_id end,
    (select coalesce(u.display_name, u.email) from public.users u where u.id = uid) || ' ' ||
      case p_decision when 'approved' then 'approved' when 'rejected' then 'rejected' else 'requested revision on' end ||
      ' ' || g.title,
    jsonb_build_object('gate_id', g.id, 'gate_code', g.code, 'gate_type', g.gate_type, 'reason', p_reason)
  );

  perform set_config('pod_lab.gate_context', 'off', true);
  return g;
end;
$$;

revoke execute on function public.decide_approval_gate(uuid, public.approval_status, text) from public, anon;
grant execute on function public.decide_approval_gate(uuid, public.approval_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace creation (bootstraps owner membership atomically)
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  w public.workspaces%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.workspace_members where user_id = uid and role = 'owner') >= 10 then
    raise exception 'Workspace limit reached' using errcode = 'check_violation';
  end if;
  insert into public.workspaces (name, slug, created_by) values (trim(p_name), lower(trim(p_slug)), uid)
  returning * into w;
  insert into public.workspace_members (workspace_id, user_id, role) values (w.id, uid, 'owner');
  insert into public.audit_log (workspace_id, actor_type, actor_id, action, subject_type, subject_id, summary)
  values (w.id, 'human', uid, 'workspace.created', 'workspace', w.id, 'Workspace "' || w.name || '" created');
  return w;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- Helper functions that must never be callable by API clients directly.
revoke execute on function public.next_code(uuid, text) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Global search (security invoker => RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.search_workspace(p_workspace uuid, p_query text)
returns table (kind text, id uuid, code text, title text, subtitle text, brand_id uuid)
language sql
stable
set search_path = ''
as $$
  with q as (select '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%' as pat)
  select * from (
    select 'brand'::text, b.id, b.code, coalesce(b.official_name, b.working_title), b.niche || ' · ' || b.stage::text, b.id
      from public.brands b, q
     where b.workspace_id = p_workspace
       and (b.working_title ilike q.pat or b.official_name ilike q.pat or b.niche ilike q.pat or b.code ilike q.pat)
    union all
    select 'opportunity', o.id, o.code, o.niche, o.status::text, o.brand_id
      from public.opportunities o, q
     where o.workspace_id = p_workspace and (o.niche ilike q.pat or o.hypothesis ilike q.pat or o.code ilike q.pat)
    union all
    select 'design', d.id, d.code, d.title, d.status::text, d.brand_id
      from public.design_concepts d, q
     where d.workspace_id = p_workspace and (d.title ilike q.pat or d.concept ilike q.pat or d.code ilike q.pat)
    union all
    select 'product', p.id, p.code, p.title, p.status, p.brand_id
      from public.brand_products p, q
     where p.workspace_id = p_workspace and (p.title ilike q.pat or p.code ilike q.pat)
    union all
    select 'experiment', e.id, e.code, e.name, e.status, e.brand_id
      from public.experiments e, q
     where e.workspace_id = p_workspace and (e.name ilike q.pat or e.hypothesis ilike q.pat or e.code ilike q.pat)
    union all
    select 'agent', a.id, a.key, a.name, a.description, null::uuid
      from public.agents a, q
     where a.workspace_id = p_workspace and (a.name ilike q.pat or a.key ilike q.pat)
    union all
    select 'note', n.id, null, left(n.body, 80), n.subject_type, n.brand_id
      from public.notes n, q
     where n.workspace_id = p_workspace and n.body ilike q.pat
    union all
    select 'trend', t.id, t.code, t.name, t.category, null::uuid
      from public.trends t, q
     where t.workspace_id = p_workspace and (t.name ilike q.pat or t.code ilike q.pat)
    union all
    select 'insight', i.id, i.code, i.title, i.confidence::text, i.brand_id
      from public.insights i, q
     where i.workspace_id = p_workspace and (i.title ilike q.pat or i.body ilike q.pat)
  ) r
  limit 60;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, objects namespaced by workspace id (first folder)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pod-lab', 'pod-lab', false, 26214400,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/csv', 'application/json', 'text/plain']
)
on conflict (id) do nothing;

create or replace function public.storage_workspace_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end;
$$;

create policy pod_lab_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'pod-lab' and public.is_workspace_member(public.storage_workspace_id(name)));
create policy pod_lab_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pod-lab' and public.has_workspace_role(public.storage_workspace_id(name), 'editor'));
create policy pod_lab_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'pod-lab' and public.has_workspace_role(public.storage_workspace_id(name), 'editor'));
create policy pod_lab_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pod-lab' and public.has_workspace_role(public.storage_workspace_id(name), 'admin'));
