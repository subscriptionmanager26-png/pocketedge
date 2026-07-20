-- On-time GitHub Actions triggers for sub-daily market jobs.
-- Vercel Hobby only allows daily crons; equity/commodities use Supabase pg_cron instead.

create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.social_market_job_config (job_name, auth_token)
values ('dispatch-github-workflow', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  job_names text[] := array[
    'social-gh-dispatch-equity-session',
    'social-gh-dispatch-equity-eod',
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod'
  ];
  j text;
begin
  foreach j in array job_names loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  -- Equity: every 15 min during session (04:00–10:00 UTC weekdays)
  perform cron.schedule(
    'social-gh-dispatch-equity-session',
    '0,15,30,45 4-10 * * 1-5',
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

  -- Equity post-close (15:45 IST)
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

  -- Commodities hourly during MCX window
  perform cron.schedule(
    'social-gh-dispatch-commodities-hourly',
    '0 4-18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"commodities"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );

  -- Commodities EOD
  perform cron.schedule(
    'social-gh-dispatch-commodities-eod',
    '45 18 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"commodities"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;
