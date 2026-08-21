-- MCX WAF blocks both Supabase edge and Vercel serverless egress (403).
-- Drop broken GitHub workflow_dispatch crons (depended on expired PAT).
-- Primary refresh is native GH Actions schedule on
-- .github/workflows/social-market-price-commodities.yml (no GITHUB_DISPATCH_TOKEN).

create extension if not exists pg_cron;

do $$
declare
  job_id bigint;
  j text;
begin
  foreach j in array array[
    'social-gh-dispatch-commodities-hourly',
    'social-gh-dispatch-commodities-eod',
    'social-commodity-refresh-hourly',
    'social-commodity-refresh-eod'
  ]
  loop
    select jobid into job_id from cron.job where jobname = j limit 1;
    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end loop;
end
$$;
