-- Public share/OG cards need anon access to the redacted RPC (no qty/avg/value).
grant execute on function public.get_public_portfolio_share(uuid) to anon, authenticated;

comment on function public.get_public_portfolio_share(uuid) is
  'Public redacted portfolio payload for share/OG. Safe for anon; no qty/avg/value.';
