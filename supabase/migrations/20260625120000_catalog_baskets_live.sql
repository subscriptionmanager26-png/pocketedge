-- Catalog baskets as live DB rows with NAV tracking + marketplace listing.

alter table public.baskets
  add column if not exists catalog_slug text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists baskets_catalog_slug_idx
  on public.baskets (catalog_slug)
  where catalog_slug is not null;

-- Raise basket cap (2 user + 4 catalog = 6 for primary creator).
create or replace function public.save_basket_version(
  p_basket_id uuid default null,
  p_name text default null,
  p_short_description text default null,
  p_description text default null,
  p_image_url text default null,
  p_image_gradient text default null,
  p_weighting_type text default 'equal',
  p_rebalance_frequency text default 'quarterly',
  p_constituents jsonb default '[]'::jsonb,
  p_changes_from_previous jsonb default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  basket_row public.baskets;
  next_version integer;
  version_row public.basket_versions;
  active_count integer;
  max_baskets constant integer := 10;
  is_new boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'Basket name is required';
  end if;

  if p_basket_id is null then
    select count(*)::integer into active_count
    from public.baskets
    where creator_id = uid and not is_deleted;

    if active_count >= max_baskets then
      raise exception 'You can create a maximum of % baskets.', max_baskets;
    end if;

    insert into public.baskets (creator_id, current_version)
    values (uid, 1)
    returning * into basket_row;

    next_version := 1;
    is_new := true;
  else
    select * into basket_row
    from public.baskets
    where id = p_basket_id and creator_id = uid and not is_deleted;

    if not found then
      raise exception 'Basket not found';
    end if;

    next_version := basket_row.current_version + 1;

    update public.baskets
    set current_version = next_version, updated_at = now()
    where id = basket_row.id;
  end if;

  insert into public.basket_versions (
    basket_id,
    version_number,
    name,
    short_description,
    description,
    image_url,
    image_gradient,
    weighting_type,
    rebalance_frequency,
    constituents,
    changes_from_previous
  )
  values (
    basket_row.id,
    next_version,
    trim(p_name),
    nullif(trim(p_short_description), ''),
    nullif(trim(p_description), ''),
    nullif(trim(p_image_url), ''),
    nullif(trim(p_image_gradient), ''),
    coalesce(nullif(trim(p_weighting_type), ''), 'equal'),
    coalesce(nullif(trim(p_rebalance_frequency), ''), 'quarterly'),
    coalesce(p_constituents, '[]'::jsonb),
    p_changes_from_previous
  )
  returning * into version_row;

  if is_new then
    perform public.initialize_basket_nav(basket_row.id);
  end if;

  return json_build_object(
    'id', basket_row.id,
    'creator_id', basket_row.creator_id,
    'catalog_slug', basket_row.catalog_slug,
    'metadata', basket_row.metadata,
    'version_number', version_row.version_number,
    'name', version_row.name,
    'short_description', version_row.short_description,
    'description', version_row.description,
    'image_url', version_row.image_url,
    'image_gradient', version_row.image_gradient,
    'weighting_type', version_row.weighting_type,
    'rebalance_frequency', version_row.rebalance_frequency,
    'constituents', version_row.constituents,
    'changes_from_previous', version_row.changes_from_previous,
    'created_at', basket_row.created_at,
    'updated_at', basket_row.updated_at
  );
end;
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
      b.updated_at
    from public.baskets b
    join public.basket_versions v
      on v.basket_id = b.id and v.version_number = b.current_version
    where b.creator_id = target and not b.is_deleted
  ) t;

  return result;
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
      cp.avatar_url as creator_avatar_url
    from public.baskets b
    join public.basket_versions v
      on v.basket_id = b.id and v.version_number = b.current_version
    left join public.creator_profiles cp on cp.user_id = b.creator_id
    where not b.is_deleted
  ) t;
$$;

create or replace function public.resolve_basket_id(p_key text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select b.id
  from public.baskets b
  where not b.is_deleted
    and (
      b.id::text = p_key
      or b.catalog_slug = p_key
    )
  limit 1;
$$;

revoke all on function public.list_marketplace_baskets() from public;
grant execute on function public.list_marketplace_baskets() to anon, authenticated;

revoke all on function public.resolve_basket_id(text) from public;
grant execute on function public.resolve_basket_id(text) to anon, authenticated;
