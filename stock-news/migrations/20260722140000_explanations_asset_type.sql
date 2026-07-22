-- Tag daily explanations by instrument class (stock / index / commodity / economics).
ALTER TABLE public.mn_daily_stock_explanations
  ADD COLUMN IF NOT EXISTS asset_type text;

ALTER TABLE public.mn_daily_stock_explanations_openai
  ADD COLUMN IF NOT EXISTS asset_type text;

UPDATE public.mn_daily_stock_explanations
SET asset_type = 'stock'
WHERE asset_type IS NULL;

UPDATE public.mn_daily_stock_explanations_openai
SET asset_type = 'stock'
WHERE asset_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_mn_daily_explanations_asset_type
  ON public.mn_daily_stock_explanations (asset_type, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_mn_daily_explanations_openai_asset_type
  ON public.mn_daily_stock_explanations_openai (asset_type, as_of_date DESC);
