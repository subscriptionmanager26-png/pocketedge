-- Security hardening: rotate job tokens, tighten RLS/RPC grants.
-- NOTE: github-dispatch-pat is retained until GITHUB_DISPATCH_TOKEN is set as a
-- Supabase Edge Function secret (Dashboard → Edge Functions → Secrets). Then run:
--   delete from public.social_market_job_config where job_name = 'github-dispatch-pat';

-- ---------------------------------------------------------------------------
-- 1. Rotate opaque cron/edge auth tokens (invalidates any leaked copies)
-- ---------------------------------------------------------------------------
update public.social_market_job_config
set auth_token = encode(gen_random_bytes(24), 'hex'),
    updated_at = now()
where job_name in (
  'refresh-index-prices',
  'refresh-equity-prices',
  'dispatch-github-workflow'
);

-- Ensure deny policy on job config (idempotent)
drop policy if exists "social_market_job_config_no_client_access"
  on public.social_market_job_config;
create policy "social_market_job_config_no_client_access"
  on public.social_market_job_config for all
  to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 2. Public portfolio share via redacted RPC (no raw holdings service-role SELECT)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_portfolio_share(p_portfolio_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  row public.social_portfolios;
  owner_username text;
  owner_display text;
begin
  select * into row
  from public.social_portfolios
  where id = p_portfolio_id
    and not coalesce(is_draft, false)
    and not coalesce(is_archived, false);

  if row.id is null then
    return null;
  end if;

  select pr.username, pr.display_name
  into owner_username, owner_display
  from public.social_profiles pr
  where pr.user_id = row.owner_id;

  return json_build_object(
    'portfolio', public.map_social_portfolio_row_public(row),
    'ownerHandle', owner_username,
    'ownerName', owner_display
  );
end;
$$;

revoke all on function public.get_public_portfolio_share(uuid) from public, anon, authenticated;
grant execute on function public.get_public_portfolio_share(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Restrict holder list to authenticated users
-- ---------------------------------------------------------------------------
revoke all on function public.list_social_asset_holders(text, integer) from public, anon;
grant execute on function public.list_social_asset_holders(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lock fetch run metadata to service role only
-- ---------------------------------------------------------------------------
drop policy if exists "social_market_price_fetch_runs_select_authenticated"
  on public.social_market_price_fetch_runs;
revoke select on public.social_market_price_fetch_runs from authenticated;
