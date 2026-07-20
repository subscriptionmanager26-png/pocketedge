-- Supabase-managed index quote refresh:
-- - every 30 seconds for social_market_assets (asset_type = 'index')
-- - one post-close run to persist deterministic EOD history
-- - lock helpers to avoid overlapping cron executions

create table if not exists public.social_market_job_locks (
  job_name text primary key,
  owner text,
  locked_at timestamptz not null default now()
);

alter table public.social_market_job_locks enable row level security;

drop policy if exists "social_market_job_locks_no_client_access"
  on public.social_market_job_locks;
create policy "social_market_job_locks_no_client_access"
  on public.social_market_job_locks for all
  to authenticated
  using (false)
  with check (false);

create or replace function public.acquire_social_market_job_lock(
  p_job_name text,
  p_ttl_seconds integer default 120,
  p_owner text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ttl interval := make_interval(secs => greatest(coalesce(p_ttl_seconds, 120), 15));
  owner_text text := coalesce(nullif(trim(p_owner), ''), auth.uid()::text, 'system');
begin
  if coalesce(trim(p_job_name), '') = '' then
    raise exception 'job name required';
  end if;

  insert into public.social_market_job_locks (job_name, owner, locked_at)
  values (p_job_name, owner_text, now())
  on conflict (job_name) do update
    set owner = excluded.owner,
        locked_at = excluded.locked_at
    where public.social_market_job_locks.locked_at < (now() - ttl);

  return exists (
    select 1
    from public.social_market_job_locks
    where job_name = p_job_name
      and owner = owner_text
      and locked_at >= (now() - interval '5 seconds')
  );
end;
$$;

create or replace function public.release_social_market_job_lock(
  p_job_name text,
  p_owner text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_text text := coalesce(nullif(trim(p_owner), ''), auth.uid()::text, 'system');
begin
  delete from public.social_market_job_locks
  where job_name = p_job_name
    and owner = owner_text;
  return found;
end;
$$;

revoke all on table public.social_market_job_locks from public, anon, authenticated;
revoke all on function public.acquire_social_market_job_lock(text, integer, text)
  from public, anon, authenticated;
revoke all on function public.release_social_market_job_lock(text, text)
  from public, anon, authenticated;
grant execute on function public.acquire_social_market_job_lock(text, integer, text) to service_role;
grant execute on function public.release_social_market_job_lock(text, text) to service_role;

do $$
declare
  has_cron boolean;
  has_net boolean;
  has_vault boolean;
  has_url_secret boolean;
  has_auth_secret boolean;
  supabase_url text;
  service_role_key text;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net') into has_net;
  select exists (select 1 from pg_extension where extname = 'vault') into has_vault;

  if not has_cron or not has_net or not has_vault then
    raise notice 'Skipping index cron scheduling: required extensions missing (pg_cron, pg_net, vault).';
    return;
  end if;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  if supabase_url is not null and not exists (
    select 1 from vault.decrypted_secrets where name = 'index_refresh_url'
  ) then
    perform vault.create_secret(
      supabase_url || '/functions/v1/refresh-index-prices',
      'index_refresh_url'
    );
  end if;

  if service_role_key is not null and not exists (
    select 1 from vault.decrypted_secrets where name = 'index_refresh_auth'
  ) then
    perform vault.create_secret(service_role_key, 'index_refresh_auth');
  end if;

  select exists (select 1 from vault.decrypted_secrets where name = 'index_refresh_url')
    into has_url_secret;
  select exists (select 1 from vault.decrypted_secrets where name = 'index_refresh_auth')
    into has_auth_secret;

  if not has_url_secret or not has_auth_secret then
    raise notice 'Skipping index cron scheduling: create vault secrets index_refresh_url and index_refresh_auth first.';
    return;
  end if;

  perform cron.unschedule('social-index-refresh-30s');
  perform cron.unschedule('social-index-refresh-eod');

  perform cron.schedule(
    'social-index-refresh-30s',
    '30 seconds',
    $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'index_refresh_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'index_refresh_auth')
      ),
      body := '{"write_history":false}'::jsonb,
      timeout_milliseconds := 10000
    );
    $cmd$
  );

  -- Post-close EOD snapshot (NSE close) to keep a deterministic daily history point.
  perform cron.schedule(
    'social-index-refresh-eod',
    '15 10 * * 1-5',
    $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'index_refresh_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'index_refresh_auth')
      ),
      body := '{"write_history":true}'::jsonb,
      timeout_milliseconds := 15000
    );
    $cmd$
  );
end
$$;
