-- Tighten EXECUTE grants on SECURITY DEFINER functions (flagged by the hosted
-- Supabase security advisor). Supabase grants EXECUTE on new public functions to
-- anon and authenticated by default, which exposes them as /rest/v1/rpc endpoints.

-- Trigger functions are never meant to be called directly. EXECUTE is checked when
-- a trigger is created, not when it fires, so revoking it does not affect triggers.
revoke execute on function public.assign_code() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- RLS helpers: evaluated inside policies that only apply to signed-in users.
revoke execute on function public.has_workspace_role(uuid, public.workspace_role) from public, anon;
grant execute on function public.has_workspace_role(uuid, public.workspace_role) to authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
