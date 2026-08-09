-- cron.job_run_details is optional pg_cron history (not needed for jobs to run).
-- Cap retention at 7 days so high-frequency refresh jobs do not grow the table forever.

create or replace function public.prune_cron_job_run_details(p_retain_days integer default 7)
returns bigint
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  deleted bigint;
  retain integer := greatest(1, least(coalesce(p_retain_days, 7), 30));
begin
  delete from cron.job_run_details
  where start_time < now() - make_interval(days => retain);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.prune_cron_job_run_details(integer) from public, anon, authenticated;
grant execute on function public.prune_cron_job_run_details(integer) to postgres, service_role;

-- One-shot prune of current backlog.
select public.prune_cron_job_run_details(7);

do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'prune-cron-job-run-details' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  -- Daily at 03:15 UTC (~08:45 IST).
  perform cron.schedule(
    'prune-cron-job-run-details',
    '15 3 * * *',
    $cmd$select public.prune_cron_job_run_details(7);$cmd$
  );
end
$$;
