-- A historical NAV backfill can introduce a previously missing intermediary
-- date. Rebuild each fund's immediately-prior NAV and daily change from the
-- chronological history so portfolios always compare latest vs prior latest.

with sequenced as (
  select
    asset_type,
    asset_key,
    as_of_date,
    close_price,
    lag(close_price) over (
      partition by asset_type, asset_key
      order by as_of_date asc
    ) as prior_close
  from public.social_market_price_history
  where asset_type = 'fund'
)
update public.social_market_price_history h
set
  previous_close = s.prior_close,
  change_pct = case
    when s.prior_close is not null and s.prior_close <> 0
      then ((s.close_price - s.prior_close) / s.prior_close) * 100
    else null
  end
from sequenced s
where h.asset_type = s.asset_type
  and h.asset_key = s.asset_key
  and h.as_of_date = s.as_of_date
  and (
    h.previous_close is distinct from s.prior_close
    or h.change_pct is distinct from case
      when s.prior_close is not null and s.prior_close <> 0
        then ((s.close_price - s.prior_close) / s.prior_close) * 100
      else null
    end
  );

with sequenced as (
  select
    asset_key,
    as_of_date,
    close_price,
    lag(close_price) over (partition by asset_key order by as_of_date asc) as prior_close
  from public.social_market_price_history
  where asset_type = 'fund'
),
latest as (
  select distinct on (asset_key)
    asset_key,
    as_of_date,
    prior_close
  from sequenced
  order by asset_key, as_of_date desc
)
update public.social_market_assets a
set
  previous_close = l.prior_close,
  change_pct = case
    when l.prior_close is not null and l.prior_close <> 0
      then ((a.price - l.prior_close) / l.prior_close) * 100
    else null
  end
from latest l
where a.asset_type = 'fund'
  and a.asset_key = l.asset_key
  and a.as_of_date = l.as_of_date
  and (
    a.previous_close is distinct from l.prior_close
    or a.change_pct is distinct from case
      when l.prior_close is not null and l.prior_close <> 0
        then ((a.price - l.prior_close) / l.prior_close) * 100
      else null
    end
  );
