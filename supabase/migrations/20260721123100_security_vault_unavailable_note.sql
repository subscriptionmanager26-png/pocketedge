-- Phase 4: Vault is not available on this project (no vault extension).
-- Job auth tokens remain in social_market_job_config with:
--   - RLS deny for authenticated
--   - REVOKE ALL from anon/authenticated
--   - Tokens rotated by 20260721120000 / 20260721121500
-- Prefer setting GITHUB_DISPATCH_TOKEN as an Edge Function secret so the PAT
-- is not stored in Postgres.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'vault') then
    raise notice 'vault extension present — consider migrating job tokens to vault.secrets';
  else
    raise notice 'vault extension unavailable — keeping job tokens in social_market_job_config with RLS lockdown';
  end if;
end
$$;
