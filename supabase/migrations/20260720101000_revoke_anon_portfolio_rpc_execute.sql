-- Tighten EXECUTE grants left over after lock_portfolio_absolute_values:
-- Supabase often grants anon explicitly; REVOKE FROM PUBLIC alone is insufficient.

revoke all on function public.portfolio_total_return_pct(jsonb) from public, anon, authenticated;
revoke all on function public.redact_holdings_for_public(jsonb) from public, anon, authenticated;
revoke all on function public.map_social_portfolio_row_public(public.social_portfolios) from public, anon, authenticated;
revoke all on function public.materialize_holdings_from_public(jsonb, numeric) from public, anon, authenticated;

revoke all on function public.list_user_portfolios(uuid) from public, anon;
revoke all on function public.get_user_portfolio(uuid, uuid) from public, anon;
revoke all on function public.toggle_portfolio_copy(uuid) from public, anon;
revoke all on function public.get_influencing_bucket(uuid) from public, anon;
revoke all on function public.get_influencing_amount(uuid) from public, anon;
revoke all on function public.enrich_portfolio_holdings(jsonb) from public, anon;

grant execute on function public.list_user_portfolios(uuid) to authenticated;
grant execute on function public.get_user_portfolio(uuid, uuid) to authenticated;
grant execute on function public.toggle_portfolio_copy(uuid) to authenticated;
grant execute on function public.get_influencing_bucket(uuid) to authenticated;
grant execute on function public.get_influencing_amount(uuid) to authenticated;
grant execute on function public.enrich_portfolio_holdings(jsonb) to authenticated;
