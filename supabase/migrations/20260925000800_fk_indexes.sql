-- Covering indexes for every foreign key in the public schema that does not
-- already lead an index (flagged by the Supabase performance advisor). Cascading
-- deletes and joins on these columns would otherwise scan whole tables.
do $$
declare
  r record;
  idx text;
begin
  for r in
    select c.conrelid::regclass as tbl, cl.relname as table_name, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    idx := left(r.table_name || '_' || r.col || '_fkey_idx', 63);
    execute format('create index if not exists %I on %s (%I)', idx, r.tbl, r.col);
  end loop;
end;
$$;
