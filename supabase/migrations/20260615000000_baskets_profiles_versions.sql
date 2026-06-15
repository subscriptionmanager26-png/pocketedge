-- Creator profiles, versioned user baskets, subscriptions, and tracked investments.

-- ---------------------------------------------------------------------------
-- Creator profiles (About you)
-- ---------------------------------------------------------------------------

create table if not exists public.creator_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  bio text,
  avatar_url text,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_profiles enable row level security;

create policy "creator_profiles_select_public"
  on public.creator_profiles for select
  to anon, authenticated
  using (true);

create policy "creator_profiles_upsert_own"
  on public.creator_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "creator_profiles_update_own"
  on public.creator_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Baskets (logical entity) + immutable versions
-- ---------------------------------------------------------------------------

create table if not exists public.baskets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  current_version integer not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists baskets_creator_idx on public.baskets (creator_id)
  where not is_deleted;

create table if not exists public.basket_versions (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references public.baskets (id) on delete cascade,
  version_number integer not null,
  name text not null,
  short_description text,
  description text,
  image_url text,
  image_gradient text,
  weighting_type text not null default 'equal',
  rebalance_frequency text not null default 'quarterly',
  constituents jsonb not null default '[]'::jsonb,
  changes_from_previous jsonb,
  created_at timestamptz not null default now(),
  constraint basket_versions_unique_number unique (basket_id, version_number)
);

create index if not exists basket_versions_basket_idx
  on public.basket_versions (basket_id, version_number desc);

alter table public.baskets enable row level security;
alter table public.basket_versions enable row level security;

create policy "baskets_select_public"
  on public.baskets for select
  to anon, authenticated
  using (not is_deleted);

create policy "baskets_insert_own"
  on public.baskets for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "baskets_update_own"
  on public.baskets for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "basket_versions_select_public"
  on public.basket_versions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.baskets b
      where b.id = basket_id and not b.is_deleted
    )
  );

create policy "basket_versions_insert_own"
  on public.basket_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.baskets b
      where b.id = basket_id and b.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Subscriptions & paper-tracked investments (per user)
-- ---------------------------------------------------------------------------

create table if not exists public.basket_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  basket_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, basket_key)
);

create table if not exists public.tracked_investments (
  user_id uuid not null references auth.users (id) on delete cascade,
  basket_key text not null,
  invested_amount numeric(18, 2) not null check (invested_amount > 0),
  since date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (user_id, basket_key)
);

alter table public.basket_subscriptions enable row level security;
alter table public.tracked_investments enable row level security;

create policy "basket_subscriptions_own"
  on public.basket_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tracked_investments_own"
  on public.tracked_investments for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RPC: creator profile
-- ---------------------------------------------------------------------------

create or replace function public.upsert_creator_profile(
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_links jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.creator_profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.creator_profiles (user_id, display_name, bio, avatar_url, links)
  values (uid, nullif(trim(p_display_name), ''), nullif(trim(p_bio), ''), nullif(trim(p_avatar_url), ''), coalesce(p_links, '[]'::jsonb))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    avatar_url = excluded.avatar_url,
    links = excluded.links,
    updated_at = now()
  returning * into row;

  return json_build_object(
    'user_id', row.user_id,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'links', row.links,
    'updated_at', row.updated_at
  );
end;
$$;

create or replace function public.get_creator_profile(p_user_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(p_user_id, auth.uid());
  row public.creator_profiles;
begin
  if target is null then
    return null;
  end if;

  select * into row from public.creator_profiles where user_id = target;

  if not found then
    return null;
  end if;

  return json_build_object(
    'user_id', row.user_id,
    'display_name', row.display_name,
    'bio', row.bio,
    'avatar_url', row.avatar_url,
    'links', row.links,
    'updated_at', row.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: save basket (creates entity + version; edits append new version)
-- ---------------------------------------------------------------------------

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
  max_baskets constant integer := 5;
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

  return json_build_object(
    'id', basket_row.id,
    'creator_id', basket_row.creator_id,
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

-- ---------------------------------------------------------------------------
-- RPC: list baskets (current version) for a creator
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- RPC: version history for a basket
-- ---------------------------------------------------------------------------

create or replace function public.list_basket_versions(p_basket_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(t) order by t.version_number asc), '[]'::json)
  into result
  from (
    select
      v.id,
      v.basket_id,
      v.version_number,
      v.name,
      v.short_description,
      v.description,
      v.image_url,
      v.image_gradient,
      v.weighting_type,
      v.rebalance_frequency,
      v.constituents,
      v.changes_from_previous,
      v.created_at
    from public.basket_versions v
    join public.baskets b on b.id = v.basket_id
    where v.basket_id = p_basket_id and not b.is_deleted
  ) t;

  return result;
end;
$$;

revoke all on function public.upsert_creator_profile(text, text, text, jsonb) from public;
grant execute on function public.upsert_creator_profile(text, text, text, jsonb) to authenticated;

revoke all on function public.get_creator_profile(uuid) from public;
grant execute on function public.get_creator_profile(uuid) to anon, authenticated;

revoke all on function public.save_basket_version(uuid, text, text, text, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.save_basket_version(uuid, text, text, text, text, text, text, text, jsonb, jsonb) to authenticated;

revoke all on function public.list_creator_baskets(uuid) from public;
grant execute on function public.list_creator_baskets(uuid) to anon, authenticated;

revoke all on function public.list_basket_versions(uuid) from public;
grant execute on function public.list_basket_versions(uuid) to anon, authenticated;
