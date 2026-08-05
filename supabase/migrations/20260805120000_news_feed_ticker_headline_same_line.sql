-- Put security mention + headline on one continuous line for news feed posts.
-- Bullets stay in the following paragraph (after a blank line).

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
  v_lead text;
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

  -- Lead: @TICKER Headline on one continuous line (then a blank line before bullets).
  if v_ticker is not null and v_headline is not null then
    v_lead := '@' || v_ticker || ' ' || v_headline;
  elsif v_ticker is not null then
    v_lead := '@' || v_ticker;
  elsif v_headline is not null then
    v_lead := v_headline;
  else
    v_lead := null;
  end if;

  if v_lead is not null then
    v_out := array_append(v_out, v_lead);
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

revoke all on function public.format_news_ai_summary_body(jsonb) from public;
grant execute on function public.format_news_ai_summary_body(jsonb) to service_role;
