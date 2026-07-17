-- Repair quote values overwritten by the asset-identity catalog sync.
-- Price history is written by the live market refresh before the catalog sync
-- and therefore remains the authoritative recovery source.

with latest_history as (
  select distinct on (asset_type, asset_key)
    asset_type,
    asset_key,
    as_of_date,
    close_price,
    previous_close,
    change_pct,
    source,
    synced_at
  from public.social_market_price_history
  where asset_type in ('stock', 'etf', 'fund')
  order by asset_type, asset_key, as_of_date desc, synced_at desc
)
update public.social_market_assets a
set
  price = h.close_price,
  previous_close = h.previous_close,
  change_pct = h.change_pct,
  as_of_date = h.as_of_date,
  price_source = h.source,
  synced_at = h.synced_at
from latest_history h
where a.asset_type = h.asset_type
  and a.asset_key = h.asset_key
  and (
    a.price is distinct from h.close_price
    or a.previous_close is distinct from h.previous_close
    or a.change_pct is distinct from h.change_pct
    or a.as_of_date is distinct from h.as_of_date
    or a.price_source is distinct from h.source
  );
