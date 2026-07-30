-- Drop GH equity EOD backup so price writes are edge-only
-- (except commodities + AMC iNAV which remain on GH).

do $$
declare
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-gh-dispatch-equity-eod',
    'social-gh-dispatch-equity-session',
    'social-gh-dispatch-funds-nav-evening',
    'social-gh-dispatch-funds-nav-evening-2330',
    'social-gh-dispatch-funds-nav-evening-0030',
    'social-gh-dispatch-ibja-hourly',
    'social-gh-dispatch-ibja-3h'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;
end
$$;
