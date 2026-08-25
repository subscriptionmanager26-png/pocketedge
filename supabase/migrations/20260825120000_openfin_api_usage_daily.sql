-- Daily OpenFin /api/v1 request counters (public read for dashboard).

create table if not exists public.openfin_api_usage_daily (
  usage_date date not null default (timezone('utc', now()))::date,
  endpoint text not null,
  request_count bigint not null default 0,
  primary key (usage_date, endpoint)
);

comment on table public.openfin_api_usage_daily is
  'Aggregated daily counts for PocketEdge OpenFin API routes.';

create or replace function public.increment_openfin_api_usage(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or length(trim(p_endpoint)) = 0 then
    return;
  end if;
  insert into public.openfin_api_usage_daily (usage_date, endpoint, request_count)
  values ((timezone('utc', now()))::date, trim(p_endpoint), 1)
  on conflict (usage_date, endpoint)
  do update set request_count = public.openfin_api_usage_daily.request_count + 1;
end;
$$;

revoke all on public.openfin_api_usage_daily from public;
grant select on public.openfin_api_usage_daily to anon, authenticated;
grant all on public.openfin_api_usage_daily to service_role;

revoke all on function public.increment_openfin_api_usage(text) from public;
grant execute on function public.increment_openfin_api_usage(text) to service_role;

alter table public.openfin_api_usage_daily enable row level security;

drop policy if exists openfin_api_usage_public_read on public.openfin_api_usage_daily;
create policy openfin_api_usage_public_read
  on public.openfin_api_usage_daily
  for select
  to anon, authenticated
  using (true);
