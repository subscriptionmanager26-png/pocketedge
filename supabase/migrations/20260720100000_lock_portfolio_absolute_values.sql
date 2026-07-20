-- Lock absolute portfolio economics to the owner.
-- Non-owners get redacted holdings (weights / return % only) via RPCs.
-- Direct table SELECT is owner-only.

-- ---------------------------------------------------------------------------
-- 1. RLS: owner-only SELECT
-- ---------------------------------------------------------------------------
drop policy if exists social_portfolios_select_authenticated on public.social_portfolios;
create policy social_portfolios_select_authenticated
  on public.social_portfolios for select
  to authenticated
  using (owner_id = auth.uid() and not is_archived);

-- ---------------------------------------------------------------------------
-- 2. Redaction + return helpers
-- ---------------------------------------------------------------------------

create or replace function public.portfolio_total_return_pct(p_holdings jsonb)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with elems as (
    select value as h
    from jsonb_array_elements(coalesce(p_holdings, '[]'::jsonb))
  ),
  sums as (
    select
      coalesce(sum(
        coalesce(nullif(h->>'qty', '')::numeric, 0)
        * coalesce(nullif(h->>'avg', '')::numeric, 0)
      ), 0) as cost,
      coalesce(sum(
        coalesce(
          nullif(h->>'value', '')::numeric,
          coalesce(nullif(h->>'qty', '')::numeric, 0)
            * coalesce(
              nullif(h->>'price', '')::numeric,
              nullif(h->>'avg', '')::numeric,
              0
            )
        )
      ), 0) as market_value
    from elems
  )
  select case
    when cost > 0 then ((market_value - cost) / cost) * 100
    else null
  end
  from sums;
$$;

create or replace function public.redact_holdings_for_public(p_holdings jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  enriched jsonb := public.enrich_portfolio_holdings(coalesce(p_holdings, '[]'::jsonb));
  total_value numeric := 0;
  h jsonb;
  qty numeric;
  price numeric;
  val numeric;
  weight numeric;
  out_arr jsonb := '[]'::jsonb;
begin
  for h in select value from jsonb_array_elements(enriched)
  loop
    qty := coalesce(nullif(h->>'qty', '')::numeric, 0);
    price := coalesce(
      nullif(h->>'price', '')::numeric,
      nullif(h->>'avg', '')::numeric,
      0
    );
    val := coalesce(nullif(h->>'value', '')::numeric, qty * price);
    if val > 0 then
      total_value := total_value + val;
    end if;
  end loop;

  for h in select value from jsonb_array_elements(enriched)
  loop
    qty := coalesce(nullif(h->>'qty', '')::numeric, 0);
    price := coalesce(
      nullif(h->>'price', '')::numeric,
      nullif(h->>'avg', '')::numeric,
      0
    );
    val := coalesce(nullif(h->>'value', '')::numeric, qty * price);
    weight := coalesce(
      nullif(h->>'weightPct', '')::numeric,
      nullif(h->>'weight', '')::numeric,
      case when total_value > 0 and val > 0 then (val / total_value) * 100 else null end
    );

    -- Skip empty rows with no ticker identity.
    if coalesce(nullif(trim(h->>'ticker'), ''), nullif(trim(h->>'symbol'), '')) is null then
      continue;
    end if;

    out_arr := out_arr || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'ticker', coalesce(nullif(trim(h->>'ticker'), ''), nullif(trim(h->>'symbol'), '')),
          'symbol', nullif(trim(h->>'symbol'), ''),
          'assetName', coalesce(nullif(h->>'assetName', ''), nullif(h->>'name', '')),
          'assetType', nullif(h->>'assetType', ''),
          'isin', nullif(h->>'isin', ''),
          'logoUrl', nullif(h->>'logoUrl', ''),
          'logoIconUrl', nullif(h->>'logoIconUrl', ''),
          'logo_url', nullif(h->>'logo_url', ''),
          'logo_icon_url', nullif(h->>'logo_icon_url', ''),
          'weightPct', weight,
          'pnlPct', coalesce(
            nullif(h->>'pnlPct', '')::numeric,
            nullif(h->>'pnl_pct', '')::numeric
          ),
          'changePct', coalesce(
            nullif(h->>'changePct', '')::numeric,
            nullif(h->>'change_pct', '')::numeric
          )
        )
      )
    );
  end loop;

  return out_arr;
end;
$$;

create or replace function public.map_social_portfolio_row_public(p public.social_portfolios)
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
    'tickers', p.tickers,
    'holdings', public.redact_holdings_for_public(p.holdings),
    'total_return_pct', public.portfolio_total_return_pct(p.holdings),
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

-- Materialize editable holdings from public weights without copying source size.
-- Fixed notional ₹1,00,000 book × weight% / price → synthetic qty.
create or replace function public.materialize_holdings_from_public(
  p_holdings jsonb,
  p_notional numeric default 100000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  redacted jsonb := public.redact_holdings_for_public(p_holdings);
  h jsonb;
  weight numeric;
  price numeric;
  qty numeric;
  avg_px numeric;
  out_arr jsonb := '[]'::jsonb;
  notional numeric := greatest(coalesce(p_notional, 100000), 1);
begin
  for h in select value from jsonb_array_elements(redacted)
  loop
    weight := coalesce(nullif(h->>'weightPct', '')::numeric, 0);
    if weight <= 0 then
      continue;
    end if;

    -- Prefer live market price for the ticker.
    select a.price into price
    from public.social_market_assets a
    where (
      (a.asset_type in ('stock', 'etf', 'commodity', 'bond') and a.asset_key = upper(h->>'ticker'))
      or (a.asset_type = 'fund' and a.asset_key = h->>'ticker')
    )
    order by
      case a.asset_type
        when 'stock' then 0
        when 'etf' then 1
        when 'fund' then 2
        else 3
      end
    limit 1;

    avg_px := coalesce(nullif(price, 0), 1);
    qty := (notional * (weight / 100.0)) / avg_px;

    out_arr := out_arr || jsonb_build_array(
      h || jsonb_build_object(
        'qty', qty,
        'avg', avg_px,
        'price', avg_px,
        'value', qty * avg_px,
        'invested', qty * avg_px,
        'weightPct', weight
      )
    );
  end loop;

  return public.enrich_portfolio_holdings(out_arr);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Gate list / get RPCs
-- ---------------------------------------------------------------------------

create or replace function public.list_user_portfolios(p_owner_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if p_owner_id = uid then
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
  end if;

  return coalesce(
    (
      select json_agg(public.map_social_portfolio_row_public(p) order by p.updated_at desc)
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
  uid uuid := auth.uid();
  row public.social_portfolios;
begin
  if uid is null then
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

  if p_owner_id = uid then
    return public.map_social_portfolio_row(row);
  end if;

  return public.map_social_portfolio_row_public(row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Copy without leaking source AUM
-- ---------------------------------------------------------------------------

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
  materialized jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  if exists (
    select 1 from public.social_portfolio_copies
    where portfolio_id = p_portfolio_id and user_id = uid
  ) then
    delete from public.social_portfolio_copies
    where portfolio_id = p_portfolio_id and user_id = uid;
    now_copied := false;
    copy_id := null;
  else
    select * into src
    from public.social_portfolios
    where id = p_portfolio_id and not is_archived and not is_draft;
    if src.id is null then raise exception 'Portfolio not found'; end if;
    if src.owner_id = uid then raise exception 'Cannot copy own portfolio'; end if;

    select display_name into src_owner_name
    from public.social_profiles
    where user_id = src.owner_id;

    materialized := public.materialize_holdings_from_public(src.holdings, 100000);

    insert into public.social_portfolios (
      owner_id, kind, name, objective, thesis,
      source_portfolio_id, source_user_id, source_portfolio_name, source_user_name,
      tickers, holdings, watchlist_base_investment
    )
    values (
      uid, src.kind, src.name, src.objective, src.thesis,
      src.id, src.owner_id, src.name, src_owner_name,
      src.tickers, materialized, null
    )
    returning id into copy_id;

    insert into public.social_portfolio_copies (portfolio_id, user_id, copied_portfolio_id)
    values (p_portfolio_id, uid, copy_id);
    now_copied := true;
  end if;

  return json_build_object('copied', now_copied, 'copied_portfolio_id', copy_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Influencing: bucket only (exact INR never leaves Postgres)
-- ---------------------------------------------------------------------------

create or replace function public.get_influencing_bucket(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total numeric;
  cr numeric := 10000000; -- 1 crore
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(sum(follower_total), 0) into total
  from (
    select coalesce((
      select sum(holding_value)
      from public.social_portfolios p
      cross join lateral (
        select coalesce(sum(coalesce(nullif(h->>'value', '')::numeric, 0)), 0) as holding_value
        from jsonb_array_elements(coalesce(p.holdings, '[]'::jsonb)) h
      ) hv
      where p.owner_id = f.follower_id
        and not p.is_draft
        and not coalesce(p.is_archived, false)
    ), 0) as follower_total
    from public.social_follows f
    where f.followee_id = p_user_id
  ) s;

  if total is null or total < cr then
    return '< 1 Cr';
  elsif total < 10 * cr then
    return '1Cr+';
  elsif total < 100 * cr then
    return '10Cr+';
  elsif total < 1000 * cr then
    return '100Cr+';
  else
    return '1000Cr+';
  end if;
end;
$$;

-- Keep old name as a thin wrapper that returns NULL so accidental clients
-- cannot get an exact INR sum anymore.
create or replace function public.get_influencing_amount(p_user_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  -- Exact AUM is no longer exposed; use get_influencing_bucket.
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
-- Helpers: no client EXECUTE (only SECURITY DEFINER callers).
revoke all on function public.portfolio_total_return_pct(jsonb) from public, anon, authenticated;
revoke all on function public.redact_holdings_for_public(jsonb) from public, anon, authenticated;
revoke all on function public.map_social_portfolio_row_public(public.social_portfolios) from public, anon, authenticated;
revoke all on function public.materialize_holdings_from_public(jsonb, numeric) from public, anon, authenticated;

-- RPCs: authenticated only (Supabase often grants anon explicitly — revoke both).
revoke all on function public.list_user_portfolios(uuid) from public, anon;
revoke all on function public.get_user_portfolio(uuid, uuid) from public, anon;
revoke all on function public.toggle_portfolio_copy(uuid) from public, anon;
revoke all on function public.get_influencing_bucket(uuid) from public, anon;
revoke all on function public.get_influencing_amount(uuid) from public, anon;
revoke all on function public.enrich_portfolio_holdings(jsonb) from public, anon;

grant execute on function public.list_user_portfolios(uuid) to authenticated;
grant execute on function public.get_user_portfolio(uuid, uuid) to authenticated;
grant execute on function public.toggle_portfolio_copy(uuid) to authenticated;
grant execute on function public.get_influencing_bucket(uuid) to authenticated;
grant execute on function public.get_influencing_amount(uuid) to authenticated;
grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;
