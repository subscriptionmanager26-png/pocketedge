-- BSE fetch is capped at ~50s inside the edge fn, but full run (universe + upserts)
-- can exceed the previous 55s pg_net wait. Raise wait so cron observes success;
-- still well under free-plan edge wall clock (150s).

do $$
declare
  bse_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-bse-prices';
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'social-bse-refresh-60s' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'social-bse-refresh-60s',
    '* * * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-bse-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-bse-prices')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
      $cmd$,
      bse_url
    )
  );
end
$$;
