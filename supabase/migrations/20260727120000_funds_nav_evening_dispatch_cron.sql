-- On-time AMFI NAV refreshes for Day's PnL.
-- Mutual-fund NAVs typically publish ~9:30–10:10 PM IST. Poll three times so
-- GitHub Actions runs on schedule (Vercel Hobby cron is not reliable for this).

create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.social_market_job_config (job_name, auth_token)
values ('dispatch-github-workflow', encode(gen_random_bytes(24), 'hex'))
on conflict (job_name) do nothing;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  job_name text := 'social-gh-dispatch-funds-nav-evening';
begin
  select jobid into job_id from cron.job where jobname = job_name limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  -- 21:30, 21:50, 22:10 IST = 16:00, 16:20, 16:40 UTC (daily).
  perform cron.schedule(
    job_name,
    '0,20,40 16 * * *',
    format(
      $cmd$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-token',
          (select auth_token from public.social_market_job_config where job_name = 'dispatch-github-workflow')
        ),
        body := '{"job":"funds"}'::jsonb,
        timeout_milliseconds := 15000
      );
      $cmd$,
      dispatch_url
    )
  );
end
$$;
