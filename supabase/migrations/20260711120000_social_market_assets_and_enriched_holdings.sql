-- Server-side market asset catalog + portfolio holdings enrichment.
-- Populate social_market_assets via: npm run sync:social-market-assets

create table if not exists public.social_market_assets (
  asset_type text not null check (asset_type in ('stock', 'etf', 'fund')),
  asset_key text not null,
  name text not null,
  price numeric,
  change_pct numeric,
  synced_at timestamptz not null default now(),
  primary key (asset_type, asset_key)
);

create index if not exists social_market_assets_key_idx
  on public.social_market_assets (asset_key);

alter table public.social_market_assets enable row level security;

create policy "social_market_assets_select_authenticated"
  on public.social_market_assets for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Asset lookup + holdings enrichment
-- ---------------------------------------------------------------------------

create or replace function public.lookup_social_market_asset(p_key text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'asset_type', a.asset_type,
    'asset_key', a.asset_key,
    'name', a.name,
    'price', a.price,
    'change_pct', a.change_pct
  )
  from public.social_market_assets a
  where (a.asset_type in ('stock', 'etf') and a.asset_key = upper(trim(p_key)))
     or (a.asset_type = 'fund' and a.asset_key = trim(p_key))
  order by case a.asset_type when 'stock' then 0 when 'etf' then 1 else 2 end
  limit 1;
$$;

create or replace function public.enrich_portfolio_holdings(p_holdings jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  elem jsonb;
  result jsonb := '[]'::jsonb;
  ticker text;
  asset json;
  merged jsonb;
  stored_price numeric;
  stored_change numeric;
begin
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' then
    return '[]'::jsonb;
  end if;

  for elem in select value from jsonb_array_elements(p_holdings)
  loop
    ticker := coalesce(nullif(trim(elem->>'ticker'), ''), nullif(trim(elem->>'symbol'), ''));
    merged := elem;

    if ticker is not null then
      asset := public.lookup_social_market_asset(ticker);
      if asset is not null then
        begin
          stored_price := nullif(elem->>'price', '')::numeric;
        exception when others then
          stored_price := null;
        end;
        begin
          stored_change := nullif(elem->>'changePct', '')::numeric;
        exception when others then
          stored_change := null;
        end;

        merged := merged || jsonb_build_object(
          'ticker', asset->>'asset_key',
          'assetType', asset->>'asset_type',
          'assetName', asset->>'name',
          'price', coalesce(stored_price, (asset->>'price')::numeric),
          'changePct', coalesce(stored_change, (asset->>'change_pct')::numeric)
        );
      elsif elem ? 'assetName' then
        merged := elem;
      end if;
    end if;

    result := result || jsonb_build_array(merged);
  end loop;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Portfolio row mapping (enriched holdings on read)
-- ---------------------------------------------------------------------------

create or replace function public.map_social_portfolio_row(p public.social_portfolios)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', p.id,
    'owner_id', p.owner_id,
    'kind', p.kind,
    'name', p.name,
    'objective', p.objective,
    'thesis', p.thesis,
    'is_draft', p.is_draft,
    'is_archived', p.is_archived,
    'source_portfolio_id', p.source_portfolio_id,
    'source_user_id', p.source_user_id,
    'source_portfolio_name', p.source_portfolio_name,
    'source_user_name', p.source_user_name,
    'watchlist_base_investment', p.watchlist_base_investment,
    'tickers', p.tickers,
    'holdings', public.enrich_portfolio_holdings(p.holdings),
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

create or replace function public.list_user_portfolios(p_owner_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return coalesce(
    (
      select json_agg(public.map_social_portfolio_row(p) order by p.updated_at desc)
      from public.social_portfolios p
      where p.owner_id = p_owner_id
        and not p.is_archived
        and not p.is_draft
    ),
    '[]'::json
  );
end;
$$;

create or replace function public.get_user_portfolio(p_owner_id uuid, p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.social_portfolios;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into row
  from public.social_portfolios p
  where p.owner_id = p_owner_id
    and p.id = p_portfolio_id
    and not p.is_archived
    and not p.is_draft;

  if row.id is null then
    return null;
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

-- Persist enriched holdings on write.
create or replace function public.upsert_social_portfolio(
  p_id uuid,
  p_kind text,
  p_name text,
  p_objective text,
  p_thesis text,
  p_is_draft boolean,
  p_tickers jsonb,
  p_holdings jsonb,
  p_watchlist_base_investment numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_portfolios;
  enriched jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if coalesce(p_is_draft, false) then
    raise exception 'Draft portfolios are local-only and cannot be saved to the database';
  end if;

  enriched := public.enrich_portfolio_holdings(coalesce(p_holdings, '[]'::jsonb));

  if p_id is null then
    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis, is_draft,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, coalesce(p_kind, 'live'), coalesce(p_name, ''), coalesce(p_objective, ''),
      coalesce(p_thesis, ''), false,
      coalesce(p_tickers, '[]'::jsonb), enriched, p_watchlist_base_investment
    )
    returning * into row;
  else
    update public.social_portfolios
    set
      kind = coalesce(p_kind, kind),
      name = coalesce(p_name, name),
      objective = coalesce(p_objective, objective),
      thesis = coalesce(p_thesis, thesis),
      is_draft = false,
      tickers = coalesce(p_tickers, tickers),
      holdings = enriched,
      watchlist_base_investment = coalesce(p_watchlist_base_investment, watchlist_base_investment),
      updated_at = now()
    where id = p_id and owner_id = uid and not is_draft
    returning * into row;

    if row.id is null then
      raise exception 'Portfolio not found or not owned';
    end if;
  end if;

  return public.map_social_portfolio_row(row);
end;
$$;

-- Enrich holdings when copying a portfolio.
create or replace function public.toggle_portfolio_copy(p_portfolio_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_copied boolean;
  src public.social_portfolios;
  copy_id uuid;
  src_owner_name text;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid) then
    delete from public.social_portfolio_copies where portfolio_id = p_portfolio_id and user_id = uid;
    now_copied := false;
    copy_id := null;
  else
    select * into src from public.social_portfolios where id = p_portfolio_id and not is_archived;
    if src.id is null then raise exception 'Portfolio not found'; end if;
    if src.owner_id = uid then raise exception 'Cannot copy own portfolio'; end if;

    select display_name into src_owner_name from public.social_profiles where user_id = src.owner_id;

    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis,
      source_portfolio_id, source_user_id, source_portfolio_name, source_user_name,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, src.kind, src.name, src.objective, src.thesis,
      src.id, src.owner_id, src.name, src_owner_name,
      src.tickers, public.enrich_portfolio_holdings(src.holdings), src.watchlist_base_investment
    )
    returning id into copy_id;

    insert into public.social_portfolio_copies (portfolio_id, user_id, copied_portfolio_id)
    values (p_portfolio_id, uid, copy_id);
    now_copied := true;
  end if;

  return json_build_object('copied', now_copied, 'copied_portfolio_id', copy_id);
end;
$$;

-- Backfill existing portfolios with enriched metadata.
update public.social_portfolios
set holdings = public.enrich_portfolio_holdings(holdings)
where not is_archived and not is_draft;

-- Grants
revoke all on function public.lookup_social_market_asset(text) from public;
revoke all on function public.enrich_portfolio_holdings(jsonb) from public;
revoke all on function public.list_user_portfolios(uuid) from public;
revoke all on function public.get_user_portfolio(uuid, uuid) from public;

grant execute on function public.lookup_social_market_asset(text) to authenticated;
grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;
grant execute on function public.list_user_portfolios(uuid) to authenticated;
grant execute on function public.get_user_portfolio(uuid, uuid) to authenticated;

grant select on public.social_market_assets to authenticated;

-- Bulk catalog sync (service role / CI only).
create or replace function public.bulk_upsert_social_market_assets(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.social_market_assets (asset_type, asset_key, name, price, change_pct, synced_at)
  select
    r.asset_type,
    r.asset_key,
    r.name,
    r.price,
    r.change_pct,
    coalesce(r.synced_at::timestamptz, now())
  from jsonb_to_recordset(p_rows) as r(
    asset_type text,
    asset_key text,
    name text,
    price numeric,
    change_pct numeric,
    synced_at text
  )
  on conflict (asset_type, asset_key) do update set
    name = excluded.name,
    price = excluded.price,
    change_pct = excluded.change_pct,
    synced_at = excluded.synced_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.bulk_upsert_social_market_assets(jsonb) from public, anon, authenticated;
grant execute on function public.bulk_upsert_social_market_assets(jsonb) to service_role;
