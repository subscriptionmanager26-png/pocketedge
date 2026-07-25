-- PocketEdge News bot account + service-role ingest for mn_news_ai_summaries.

-- 1) Seed no-email auth user (reuse AMC helper), then set news profile.
select public.seed_amc_auth_user('pocketedge_news', 'PocketEdge News');

update public.social_profiles
set
  display_name = 'PocketEdge News',
  bio = 'Market news and AI summaries from PocketEdge. Not investment advice.',
  avatar_url = 'https://www.pocketedge.in/logo.png',
  focus = 'News'
where lower(username) = 'pocketedge_news';

-- 2) Webhook token for the ingest-news-summary edge function.
insert into public.social_market_job_config (job_name, auth_token)
values ('ingest-news-summary', encode(gen_random_bytes(32), 'hex'))
on conflict (job_name) do nothing;

-- 3) Idempotent ingest: one social post per summary id.
create unique index if not exists social_posts_news_summary_id_uidx
  on public.social_posts ((via->>'summary_id'))
  where via ? 'summary_id'
    and via->>'source' = 'mn_news_ai_summaries';

create or replace function public.ingest_news_ai_summary_as_post(p_summary jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_summary_id text;
  v_ticker text;
  v_type text;
  v_title text;
  v_subject text;
  v_bullets text;
  v_as_of text;
  v_external_id text;
  v_body text;
  v_existing uuid;
  v_post public.social_posts%rowtype;
  v_lines text[] := '{}';
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'p_summary must be a json object';
  end if;

  v_summary_id := nullif(btrim(coalesce(p_summary->>'id', '')), '');
  if v_summary_id is null then
    raise exception 'p_summary.id is required';
  end if;

  select user_id into v_author
  from public.social_profiles
  where lower(username) = 'pocketedge_news'
  limit 1;

  if v_author is null then
    raise exception 'pocketedge_news profile missing — run seed first';
  end if;

  select id into v_existing
  from public.social_posts
  where via->>'source' = 'mn_news_ai_summaries'
    and via->>'summary_id' = v_summary_id
  limit 1;

  if v_existing is not null then
    select * into v_post from public.social_posts where id = v_existing;
    return public.social_post_row_to_json(v_post);
  end if;

  v_ticker := upper(nullif(btrim(coalesce(p_summary->>'ticker', '')), ''));
  v_type := nullif(btrim(coalesce(p_summary->>'type', '')), '');
  v_title := nullif(btrim(coalesce(p_summary->>'title', '')), '');
  v_subject := nullif(btrim(coalesce(p_summary->>'subject', '')), '');
  v_bullets := nullif(btrim(coalesce(p_summary->>'ai_bullets', '')), '');
  v_as_of := nullif(btrim(coalesce(p_summary->>'as_of_date', '')), '');
  v_external_id := nullif(btrim(coalesce(p_summary->>'external_id', '')), '');

  if v_bullets is null then
    raise exception 'p_summary.ai_bullets is required';
  end if;

  -- Normalize escaped newlines from some writers.
  v_bullets := replace(v_bullets, E'\\n', E'\n');
  -- Feed is plain text; keep single-asterisk emphasis from WhatsApp-style bullets.
  v_bullets := regexp_replace(v_bullets, '\*\*(.+?)\*\*', '*\1*', 'g');

  if coalesce(v_title, v_subject) is not null then
    v_lines := array_append(v_lines, coalesce(v_title, v_subject));
    v_lines := array_append(v_lines, '');
  end if;

  v_lines := array_append(v_lines, v_bullets);

  if v_ticker is not null then
    v_lines := array_append(v_lines, '');
    v_lines := array_append(v_lines, '@' || v_ticker);
  end if;

  v_body := array_to_string(v_lines, E'\n');
  if length(v_body) > 20000 then
    v_body := left(v_body, 19997) || '...';
  end if;

  insert into public.social_posts (
    author_id,
    post_type,
    body,
    via,
    topics
  ) values (
    v_author,
    'text',
    v_body,
    jsonb_strip_nulls(jsonb_build_object(
      'kind', 'news',
      'label', coalesce(v_type, 'News'),
      'reason', case
        when v_as_of is not null then 'as of ' || v_as_of
        else 'market update'
      end,
      'source', 'mn_news_ai_summaries',
      'summary_id', v_summary_id,
      'external_id', v_external_id,
      'ticker', v_ticker,
      'type', v_type
    )),
    case
      when v_type is not null then array['News', v_type]
      else array['News']
    end
  )
  returning * into v_post;

  return public.social_post_row_to_json(v_post);
exception
  when unique_violation then
    select * into v_post
    from public.social_posts
    where via->>'source' = 'mn_news_ai_summaries'
      and via->>'summary_id' = v_summary_id
    limit 1;
    if v_post.id is null then
      raise;
    end if;
    return public.social_post_row_to_json(v_post);
end;
$$;

revoke all on function public.ingest_news_ai_summary_as_post(jsonb) from public;
revoke all on function public.ingest_news_ai_summary_as_post(jsonb) from anon, authenticated;
grant execute on function public.ingest_news_ai_summary_as_post(jsonb) to service_role;
