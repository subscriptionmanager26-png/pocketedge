-- Intraday BSE + SGB via dedicated edge functions; GH equity becomes EOD-only.

create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.social_market_job_config (job_name, auth_token)
values
  ('refresh-bse-prices', encode(gen_random_bytes(24), 'hex')),
  ('refresh-sgb-prices', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

do $$
declare
  bse_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-bse-prices';
  sgb_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/refresh-sgb-prices';
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  j text;
begin
  -- Drop prior BSE/SGB crons if re-applied
  foreach j in array array[
    'social-bse-refresh-60s',
    'social-sgb-refresh-60s',
    'social-gh-dispatch-equity-session'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- BSE fallback LTP every minute (edge skips outside cash session)
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
        timeout_milliseconds := 55000
      );
      $cmd$,
      bse_url
    )
  );

  -- SGB LTP every minute (edge skips outside cash session)
  perform cron.schedule(
    'social-sgb-refresh-60s',
    '* * * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sgb-refresh-token',
          (select auth_token from public.social_market_job_config where job_name = 'refresh-sgb-prices')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
      $cmd$,
      sgb_url
    )
  );

  -- Ensure EOD GH equity dispatch still exists (15:45 IST = 10:15 UTC weekdays)
  select jobid into job_id from cron.job where jobname = 'social-gh-dispatch-equity-eod' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'social-gh-dispatch-equity-eod',
    '15 10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"equity"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;

comment on extension pg_cron is 'Intraday equity LTP: NSE 15s + BSE/SGB 60s edge; GH equity EOD history only.';
