-- Insights only need as-of move % for equities.
-- Indices, commodities, and economics never show price change — clear any stored context.
UPDATE public.mn_daily_stock_explanations
SET price_context = '[]'::jsonb
WHERE asset_type IN ('index', 'commodity', 'economics')
  AND price_context IS DISTINCT FROM '[]'::jsonb;

UPDATE public.mn_daily_stock_explanations_openai
SET price_context = '[]'::jsonb
WHERE asset_type IN ('index', 'commodity', 'economics')
  AND price_context IS DISTINCT FROM '[]'::jsonb;

-- Stock explanations without an as-of price point are incomplete / stale — drop them.
DELETE FROM public.mn_daily_stock_explanations e
WHERE e.asset_type = 'stock'
  AND e.status IS DISTINCT FROM 'failed'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(e.price_context, '[]'::jsonb)) AS point
    WHERE point->>'date' = e.as_of_date::text
      AND NULLIF(point->>'changePct', '') IS NOT NULL
  );

DELETE FROM public.mn_daily_stock_explanations_openai e
WHERE e.asset_type = 'stock'
  AND e.status IS DISTINCT FROM 'failed'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(e.price_context, '[]'::jsonb)) AS point
    WHERE point->>'date' = e.as_of_date::text
      AND NULLIF(point->>'changePct', '') IS NOT NULL
  );
