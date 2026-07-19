-- Drop unused / broken RPCs with no callers in the social app.
-- Restore: see archive/backend-unused-2026-07-19/README.md
--
-- archive_social_portfolio — never called (drafts stay local)
-- get_creator_profile / upsert_creator_profile — creator_profiles table is gone

drop function if exists public.archive_social_portfolio(uuid);
drop function if exists public.get_creator_profile(uuid);
drop function if exists public.upsert_creator_profile(text, text, text, jsonb);
