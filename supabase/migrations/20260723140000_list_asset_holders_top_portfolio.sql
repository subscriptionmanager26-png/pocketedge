-- Holders list: one row per user with the portfolio where the asset has the
-- highest weight, plus how many additional portfolios also hold it.

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
          'avatar_url', x.avatar_url,
          'portfolio_id', x.portfolio_id,
          'portfolio_name', x.portfolio_name,
          'weight_pct', x.weight_pct,
          'extra_portfolios', x.extra_portfolios
        )
        order by x.display_name nulls last, x.username
      )
      from (
        with matching as (
          select
            p.id as portfolio_id,
            p.name as portfolio_name,
            p.owner_id,
            pr.username,
            pr.display_name,
            pr.avatar_url,
            coalesce((
              select max(
                greatest(
                  coalesce(nullif(h->>'weightPct', '')::numeric, 0),
                  coalesce(nullif(h->>'weight', '')::numeric, 0)
                )
              )
              from jsonb_array_elements(coalesce(p.holdings, '[]'::jsonb)) h
              where upper(
                  regexp_replace(
                    trim(both from coalesce(h->>'ticker', h->>'symbol', '')),
                    '\.(NS|BSE|NSE)$',
                    '',
                    'i'
                  )
                ) = needle
            ), 0) as weight_pct,
            coalesce((
              select max(coalesce(nullif(h->>'value', '')::numeric, 0))
              from jsonb_array_elements(coalesce(p.holdings, '[]'::jsonb)) h
              where upper(
                  regexp_replace(
                    trim(both from coalesce(h->>'ticker', h->>'symbol', '')),
                    '\.(NS|BSE|NSE)$',
                    '',
                    'i'
                  )
                ) = needle
            ), 0) as holding_value
          from public.social_portfolios p
          join public.social_profiles pr on pr.user_id = p.owner_id
          where not coalesce(p.is_archived, false)
            and not coalesce(p.is_draft, false)
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
                  and (
                    coalesce(nullif(h->>'qty', '')::numeric, 0) > 0
                    or coalesce(nullif(h->>'weightPct', '')::numeric, nullif(h->>'weight', '')::numeric, 0) > 0
                  )
              )
              or exists (
                select 1
                from jsonb_array_elements_text(coalesce(p.tickers, '[]'::jsonb)) t
                where upper(
                    regexp_replace(trim(both from t), '\.(NS|BSE|NSE)$', '', 'i')
                  ) = needle
              )
            )
        ),
        ranked as (
          select
            m.*,
            row_number() over (
              partition by m.owner_id
              order by m.weight_pct desc, m.holding_value desc, m.portfolio_name asc, m.portfolio_id asc
            ) as rn,
            count(*) over (partition by m.owner_id) as portfolio_count
          from matching m
        )
        select
          r.owner_id,
          r.username,
          r.display_name,
          r.avatar_url,
          r.portfolio_id,
          r.portfolio_name,
          r.weight_pct,
          greatest(r.portfolio_count - 1, 0)::int as extra_portfolios
        from ranked r
        where r.rn = 1
        order by r.display_name nulls last, r.username
        limit lim
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.list_social_asset_holders(text, integer) from public, anon;
grant execute on function public.list_social_asset_holders(text, integer) to authenticated;
