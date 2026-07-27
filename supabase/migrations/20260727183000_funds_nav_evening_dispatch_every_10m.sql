-- Widen evening AMFI NAV polls to every 10 minutes, 21:30–23:30 IST.
-- Used to observe when fresh NAVs actually land in the DB.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  dispatch_url text := 'https://zweqxjeuwwfrlpbuuayg.supabase.co/functions/v1/dispatch-github-workflow';
  job_id bigint;
  j text;
  job_names text[] := array[
    'social-gh-dispatch-funds-nav-evening',
    'social-gh-dispatch-funds-nav-evening-2330'
  ];
  cmd text;
begin
  foreach j in array job_names loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;

  cmd := format(
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
  );

  -- 21:30–23:20 IST = */10 during 16:00–17:50 UTC
  perform cron.schedule(
    'social-gh-dispatch-funds-nav-evening',
    '*/10 16-17 * * *',
    cmd
  );

  -- 23:30 IST = 18:00 UTC
  perform cron.schedule(
    'social-gh-dispatch-funds-nav-evening-2330',
    '0 18 * * *',
    cmd
  );
end
$$;
