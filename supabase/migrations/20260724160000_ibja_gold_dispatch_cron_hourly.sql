-- IBJA Fine Gold (999): hourly 10×/day during 10:00–19:00 IST (till 8 PM window).
-- 10:00–19:00 IST = 04:30–13:30 UTC → cron '30 4-13 * * *'

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
begin
  -- Drop previous 3-hour job if present.
  select jobid into job_id from cron.job where jobname = 'social-gh-dispatch-ibja-3h' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  select jobid into job_id from cron.job where jobname = 'social-gh-dispatch-ibja-hourly' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'social-gh-dispatch-ibja-hourly',
    '30 4-13 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"ibja"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;
