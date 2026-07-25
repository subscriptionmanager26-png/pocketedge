-- Format mn_news_ai_summaries for the social feed UI (plain text, not WhatsApp).

create or replace function public.format_news_ai_summary_body(p_summary jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_ticker text;
  v_title text;
  v_subject text;
  v_bullets text;
  v_headline text;
  v_line text;
  v_clean text[] := '{}';
  v_out text[] := '{}';
begin
  v_ticker := upper(nullif(btrim(coalesce(p_summary->>'ticker', '')), ''));
  v_title := nullif(btrim(coalesce(p_summary->>'title', '')), '');
  v_subject := nullif(btrim(coalesce(p_summary->>'subject', '')), '');
  v_bullets := nullif(btrim(coalesce(p_summary->>'ai_bullets', '')), '');

  if v_bullets is null then
    return null;
  end if;

  -- Normalize escaped newlines from some writers.
  v_bullets := replace(v_bullets, E'\\n', E'\n');
  -- Strip WhatsApp / markdown bold — feed shows asterisks literally.
  -- POSIX regex only (no non-greedy quantifiers).
  v_bullets := regexp_replace(v_bullets, '\*\*([^*]+)\*\*', '\1', 'g');
  v_bullets := regexp_replace(v_bullets, '\*([^*]+)\*', '\1', 'g');

  v_headline := coalesce(v_title, v_subject);
  if v_headline is not null then
    v_headline := regexp_replace(v_headline, '\*\*([^*]+)\*\*', '\1', 'g');
    v_headline := regexp_replace(v_headline, '\*([^*]+)\*', '\1', 'g');
    -- Drop redundant "TICKER:" / "TICKER " prefixes already covered by @mention.
    if v_ticker is not null then
      v_headline := regexp_replace(
        v_headline,
        '^' || v_ticker || '[[:space:]]*[:\-–—][[:space:]]*',
        '',
        'i'
      );
      v_headline := nullif(btrim(v_headline), '');
    end if;
  end if;

  -- Lead with @TICKER so feed preview + DisclosureStrip stay useful.
  if v_ticker is not null then
    v_out := array_append(v_out, '@' || v_ticker);
    v_out := array_append(v_out, '');
  end if;

  if v_headline is not null then
    v_out := array_append(v_out, v_headline);
    v_out := array_append(v_out, '');
  end if;

  foreach v_line in array string_to_array(v_bullets, E'\n')
  loop
    v_line := btrim(v_line);
    if v_line = '' then
      continue;
    end if;
    -- Fix "• - text" / "- - text" / "* text" into a single bullet.
    v_line := regexp_replace(v_line, '^([•*-]+[[:space:]]*)+', '');
    v_line := btrim(v_line);
    if v_line = '' then
      continue;
    end if;
    v_clean := array_append(v_clean, '• ' || v_line);
  end loop;

  if array_length(v_clean, 1) is not null then
    v_out := v_out || v_clean;
  end if;

  return nullif(btrim(array_to_string(v_out, E'\n')), '');
end;
$$;

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
  v_as_of text;
  v_external_id text;
  v_body text;
  v_existing uuid;
  v_post public.social_posts%rowtype;
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

  v_ticker := upper(nullif(btrim(coalesce(p_summary->>'ticker', '')), ''));
  v_type := nullif(btrim(coalesce(p_summary->>'type', '')), '');
  v_as_of := nullif(btrim(coalesce(p_summary->>'as_of_date', '')), '');
  v_external_id := nullif(btrim(coalesce(p_summary->>'external_id', '')), '');
  v_body := public.format_news_ai_summary_body(p_summary);

  if v_body is null then
    raise exception 'p_summary.ai_bullets is required';
  end if;

  if length(v_body) > 20000 then
    v_body := left(v_body, 19997) || '...';
  end if;

  -- kind=person hides the via strip; author already is PocketEdge News.
  -- Keep source/summary_id for idempotency + provenance.
  if v_existing is not null then
    update public.social_posts
    set
      body = v_body,
      via = jsonb_strip_nulls(jsonb_build_object(
        'kind', 'person',
        'label', '@pocketedge_news',
        'reason', 'posted',
        'source', 'mn_news_ai_summaries',
        'summary_id', v_summary_id,
        'external_id', v_external_id,
        'ticker', v_ticker,
        'type', v_type,
        'as_of_date', v_as_of
      )),
      topics = case
        when v_type is not null then array['News', v_type]
        else array['News']
      end,
      updated_at = now()
    where id = v_existing
    returning * into v_post;
    return public.social_post_row_to_json(v_post);
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
      'kind', 'person',
      'label', '@pocketedge_news',
      'reason', 'posted',
      'source', 'mn_news_ai_summaries',
      'summary_id', v_summary_id,
      'external_id', v_external_id,
      'ticker', v_ticker,
      'type', v_type,
      'as_of_date', v_as_of
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

revoke all on function public.format_news_ai_summary_body(jsonb) from public;
grant execute on function public.format_news_ai_summary_body(jsonb) to service_role;
revoke all on function public.ingest_news_ai_summary_as_post(jsonb) from public;
revoke all on function public.ingest_news_ai_summary_as_post(jsonb) from anon, authenticated;
grant execute on function public.ingest_news_ai_summary_as_post(jsonb) to service_role;
