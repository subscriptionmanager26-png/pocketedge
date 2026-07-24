-- Dispatch AMC iNAV scrape every minute during NSE cash session (UTC 03:45–10:00 ≈ IST 09:15–15:30).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'social-gh-dispatch-amc-inav-1m' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  -- Every minute Mon–Fri 04:00–10:00 UTC (covers NSE cash; workflow itself is cheap to no-op off-hours).
  perform cron.schedule(
    'social-gh-dispatch-amc-inav-1m',
    '* 4-10 * * 1-5',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"amc-inav"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;
