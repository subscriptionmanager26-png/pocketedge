-- DMA uploader sends asset_class; social table requires NOT NULL asset_class.
-- Previous replace_nse_dma_signals omitted it and uploads failed with 23502.

CREATE OR REPLACE FUNCTION public.replace_nse_dma_signals(
  payload jsonb,
  run_meta jsonb,
  upload_secret text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  inserted integer;
  expected text;
begin
  select c.upload_secret into expected from public.nse_dma_upload_config c where c.id = 1;
  if expected is null or upload_secret is null or upload_secret <> expected then
    raise exception 'unauthorized dma upload';
  end if;

  delete from public.nse_dma_signals where symbol is not null;

  insert into public.nse_dma_signals (
    asset_class, symbol, series, as_of_date, close, dma_50, dma_200, dma_200_slope,
    n_closes, pct_vs_50, pct_vs_200, regime, updated_at
  )
  select
    coalesce(nullif(x.asset_class, ''), 'equity'),
    x.symbol,
    x.series,
    x.as_of_date::date,
    x.close,
    x.dma_50,
    x.dma_200,
    x.dma_200_slope,
    x.n_closes,
    x.pct_vs_50,
    x.pct_vs_200,
    x.regime,
    now()
  from jsonb_to_recordset(payload) as x(
    asset_class text,
    symbol text,
    series text,
    as_of_date text,
    close double precision,
    dma_50 double precision,
    dma_200 double precision,
    dma_200_slope double precision,
    n_closes integer,
    pct_vs_50 double precision,
    pct_vs_200 double precision,
    regime text
  );

  get diagnostics inserted = row_count;

  insert into public.nse_dma_signal_runs (
    id, as_of_date, row_count, bullish, mixed, bearish, insufficient, source, updated_at
  )
  values (
    1,
    (run_meta->>'as_of_date')::date,
    coalesce((run_meta->>'row_count')::integer, inserted),
    coalesce((run_meta->>'bullish')::integer, 0),
    coalesce((run_meta->>'mixed')::integer, 0),
    coalesce((run_meta->>'bearish')::integer, 0),
    coalesce((run_meta->>'insufficient')::integer, 0),
    run_meta->>'source',
    now()
  )
  on conflict (id) do update set
    as_of_date = excluded.as_of_date,
    row_count = excluded.row_count,
    bullish = excluded.bullish,
    mixed = excluded.mixed,
    bearish = excluded.bearish,
    insufficient = excluded.insufficient,
    source = excluded.source,
    updated_at = now();

  return jsonb_build_object('inserted', inserted, 'as_of_date', run_meta->>'as_of_date');
end;
$function$;
