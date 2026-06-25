-- Prefer USD / US listings in IBKR instrument search results.

drop function if exists public.search_ibkr_instruments(text, integer);

create or replace function public.search_ibkr_instruments(
  p_query text,
  p_limit integer default 20
)
returns table (
  conid bigint,
  symbol text,
  name text,
  exchange_id text,
  currency text,
  country text,
  is_prime boolean,
  instrument_type text,
  isin text,
  local_symbol text,
  ucits boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      trim(upper(coalesce(p_query, ''))) as term,
      greatest(1, least(coalesce(p_limit, 20), 50)) as lim
  )
  select
    i.conid,
    i.symbol,
    i.name,
    i.exchange_id,
    i.currency,
    i.country,
    i.is_prime,
    i.instrument_type,
    i.isin,
    i.local_symbol,
    i.ucits
  from public.ibkr_instruments i, q
  where length(q.term) >= 1
    and (
      i.symbol ilike q.term || '%'
      or i.name ilike '%' || q.term || '%'
      or coalesce(i.local_symbol, '') ilike q.term || '%'
      or coalesce(i.isin, '') ilike q.term || '%'
    )
  order by
    case
      when i.symbol = q.term then 0
      when i.symbol ilike q.term || '%' then 1
      when coalesce(i.local_symbol, '') ilike q.term || '%' then 2
      else 3
    end,
    case when i.currency = 'USD' then 0 when i.country = 'US' then 1 else 2 end,
    case when i.is_prime then 0 else 1 end,
    case when i.instrument_type = 'STK' then 0 when i.instrument_type = 'ETF' then 1 else 2 end,
    i.symbol,
    i.exchange_id
  limit (select lim from q);
$$;

revoke all on function public.search_ibkr_instruments(text, integer) from public;
grant execute on function public.search_ibkr_instruments(text, integer) to anon, authenticated;
