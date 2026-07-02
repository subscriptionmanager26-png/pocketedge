-- Total return = (current NAV / 100 - 1) * 100. Expose NAV on basket list RPCs.

create or replace function public.get_basket_nav_summary(p_basket_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  state_row public.basket_nav_state;
  current_nav numeric;
  total_return numeric;
  point_count integer;
  latest_error public.basket_nav_errors;
begin
  select s.* into state_row
  from public.basket_nav_state s
  join public.baskets b on b.id = s.basket_id
  where s.basket_id = p_basket_id and not b.is_deleted;

  if not found then
    return null;
  end if;

  current_nav := state_row.nav;
  total_return := case
    when current_nav is null then 0
    else ((current_nav / 100.0) - 1) * 100
  end;

  select count(*)::integer into point_count
  from public.basket_nav_history h
  where h.basket_id = p_basket_id;

  select * into latest_error
  from public.basket_nav_errors e
  where e.basket_id = p_basket_id
  order by e.created_at desc
  limit 1;

  return json_build_object(
    'basket_id', p_basket_id,
    'nav', current_nav,
    'inception_nav', 100,
    'total_return_pct', round(total_return::numeric, 2),
    'is_activated', state_row.is_activated,
    'nav_status', state_row.nav_status,
    'missing_conids', case
      when latest_error.id is not null then latest_error.missing_conids
      else array[]::bigint[]
    end,
    'error_at', latest_error.created_at,
    'last_fetch_at', state_row.last_fetch_at,
    'last_fetch_slot', state_row.last_fetch_slot,
    'history_points', point_count
  );
end;
$$;

create or replace function public.list_marketplace_baskets()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(json_agg(row_to_json(t) order by t.updated_at desc), '[]'::json)
  from (
    select
      b.id,
      b.creator_id,
      b.catalog_slug,
      b.metadata,
      b.current_version as version_number,
      v.name,
      v.short_description,
      v.description,
      v.image_url,
      v.image_gradient,
      v.weighting_type,
      v.rebalance_frequency,
      v.constituents,
      b.created_at,
      b.updated_at,
      cp.display_name as creator_display_name,
      cp.bio as creator_bio,
      cp.avatar_url as creator_avatar_url,
      s.nav,
      case
        when s.nav is not null then round(((s.nav / 100.0) - 1) * 100, 2)
        else null
      end as total_return_pct,
      s.last_fetch_at,
      s.last_fetch_slot,
      s.nav_status
    from public.baskets b
    join public.basket_versions v
      on v.basket_id = b.id and v.version_number = b.current_version
    left join public.basket_nav_state s on s.basket_id = b.id
    left join public.creator_profiles cp on cp.user_id = b.creator_id
    where not b.is_deleted
  ) t;
$$;

create or replace function public.list_creator_baskets(p_creator_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(p_creator_id, auth.uid());
  result json;
begin
  if target is null then
    return '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.updated_at desc), '[]'::json)
  into result
  from (
    select
      b.id,
      b.creator_id,
      b.catalog_slug,
      b.metadata,
      b.current_version as version_number,
      v.name,
      v.short_description,
      v.description,
      v.image_url,
      v.image_gradient,
      v.weighting_type,
      v.rebalance_frequency,
      v.constituents,
      b.created_at,
      b.updated_at,
      s.nav,
      case
        when s.nav is not null then round(((s.nav / 100.0) - 1) * 100, 2)
        else null
      end as total_return_pct,
      s.last_fetch_at,
      s.last_fetch_slot,
      s.nav_status
    from public.baskets b
    join public.basket_versions v
      on v.basket_id = b.id and v.version_number = b.current_version
    left join public.basket_nav_state s on s.basket_id = b.id
    where b.creator_id = target and not b.is_deleted
  ) t;

  return result;
end;
$$;
