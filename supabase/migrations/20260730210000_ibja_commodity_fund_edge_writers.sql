-- Move IBJA / commodities / funds LTP+NAV writers to edge; drop GH intraday dispatches.
-- AMC iNAV stays on GitHub for now.

create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.social_market_job_config (job_name, auth_token)
values
  ('refresh-ibja-prices', encode(gen_random_bytes(24), 'hex')),
  ('refresh-commodity-prices', encode(gen_random_bytes(24), 'hex')),
  ('refresh-fund-navs', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

do $$
declare
  ibja_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-ibja-prices';
  commodity_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-commodity-prices';
  funds_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-fund-navs';
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-ibja-refresh-hourly',
    'social-commodity-refresh-hourly',
    'social-commodity-refresh-eod',
    'social-fund-nav-refresh-evening',
    'social-fund-nav-refresh-0030',
    'social-gh-dispatch-ibja-hourly',
    'social-gh-dispatch-ibja-3h',
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod',
    'social-gh-dispatch-funds-nav-evening',
    'social-gh-dispatch-funds-nav-evening-2330',
    'social-gh-dispatch-funds-nav-evening-0030'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- IBJA Fine Gold ~10:00–19:00 IST = 04:30–13:30 UTC (minute 30)
  perform cron.schedule(
    'social-ibja-refresh-hourly',
    '30 4-13 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-ibja-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-ibja-prices')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 55000
      );
      $cmd$,
      ibja_url
    )
  );

  -- MCX spots hourly during session (≈09:00–23:30 IST = 03:30–18:00 UTC)
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

  -- MCX EOD history stamp ~00:15 IST = 18:45 UTC
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

  -- AMFI NAV every 10 min 21:30–00:20 IST = 16:00–18:50 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-evening',
    '*/10 16-18 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );

  -- Catch-up at 00:30 IST = 19:00 UTC
  perform cron.schedule(
    'social-fund-nav-refresh-0030',
    '0 19 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-fund-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-fund-navs')
        ),
        body := '{"write_history":true}'::jsonb,
        timeout_milliseconds := 140000
      );
      $cmd$,
      funds_url
    )
  );
end
$$;
