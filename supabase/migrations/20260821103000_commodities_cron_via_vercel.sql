-- MCX blocks Supabase edge egress (Akamai 403). Schedule stays on pg_cron;
-- fetch+upsert runs on Vercel Node (/api/cron/refresh-commodities), which can
-- reach mcxindia.com. Removes broken GitHub workflow_dispatch dependency.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  commodity_url text := 'https://www.pocketedge.in/api/cron/refresh-commodities';
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod',
    'social-commodity-refresh-hourly',
    'social-commodity-refresh-eod'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- Hourly during MCX session (≈09:00–23:30 IST = 03:30–18:00 UTC)
  perform cron.schedule(
    'social-commodity-refresh-hourly',
    '0 4-18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-commodity-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-commodity-prices')
        ),
        body := '{"write_history":false}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cmd$,
      commodity_url
    )
  );

  -- EOD history stamp ~00:15 IST = 18:45 UTC
  perform cron.schedule(
    'social-commodity-refresh-eod',
    '45 18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-commodity-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-commodity-prices')
        ),
        body := '{"write_history":true,"force":true}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cmd$,
      commodity_url
    )
  );
end
$$;
