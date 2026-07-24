-- Dispatch IBJA Fine Gold (999) scrape every 3 hours for SGB premium/discount.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'social-gh-dispatch-ibja-3h' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  -- Every 3 hours, all days (IBJA updates ~12:00 IST; keep spot available overnight).
  perform cron.schedule(
    'social-gh-dispatch-ibja-3h',
    '0 */3 * * *',
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
