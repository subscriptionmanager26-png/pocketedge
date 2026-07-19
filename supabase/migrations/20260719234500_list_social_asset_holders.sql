-- List distinct social users whose published portfolios hold an asset key
-- (stock/ETF ticker, fund scheme code, etc.). Used by asset Holders tabs.

create or replace function public.list_social_asset_holders(
  p_asset_key text,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := upper(trim(both from coalesce(p_asset_key, '')));
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  -- Normalize common exchange suffixes (RELIANCE.NS → RELIANCE).
  needle := regexp_replace(needle, '\.(NS|BSE|NSE)$', '', 'i');

  if needle = '' then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', x.owner_id,
          'username', x.username,
          'display_name', x.display_name,
          'avatar_url', x.avatar_url
        )
        order by x.display_name nulls last, x.username
      )
      from (
        select
          p.owner_id,
          pr.username,
          pr.display_name,
          pr.avatar_url
        from public.social_portfolios p
        join public.social_profiles pr on pr.user_id = p.owner_id
        where not coalesce(p.is_archived, false)
          and not coalesce(p.is_draft, false)
          and coalesce(p.kind, 'live') is distinct from 'watchlist'
          and (
            exists (
              select 1
              from jsonb_array_elements(coalesce(p.holdings, '[]'::jsonb)) h
              where upper(
                  regexp_replace(
                    trim(both from coalesce(h->>'ticker', h->>'symbol', '')),
                    '\.(NS|BSE|NSE)$',
                    '',
                    'i'
                  )
                ) = needle
                and coalesce(nullif(h->>'qty', '')::numeric, 0) > 0
            )
            or exists (
              select 1
              from jsonb_array_elements_text(coalesce(p.tickers, '[]'::jsonb)) t
              where upper(
                  regexp_replace(trim(both from t), '\.(NS|BSE|NSE)$', '', 'i')
                ) = needle
            )
          )
        group by p.owner_id, pr.username, pr.display_name, pr.avatar_url
        order by pr.display_name nulls last, pr.username
        limit lim
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_social_asset_holders(text, integer) from public;
grant execute on function public.list_social_asset_holders(text, integer) to anon, authenticated;
