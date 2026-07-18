/** Production origins after domain cutover (2026-07).
 *
 *  - Social app  → https://www.pocketedge.in  (and apex pocketedge.in)
 *  - Global tools → https://global.pocketedge.in  (former parent marketing/UCITS)
 *  - Legacy social.pocketedge.in redirects to www
 */

export const SOCIAL_PRODUCTION_ORIGIN = 'https://www.pocketedge.in';
export const SOCIAL_LEGACY_ORIGIN = 'https://social.pocketedge.in';
export const GLOBAL_PRODUCTION_ORIGIN = 'https://global.pocketedge.in';

/** Cookie / PostHog root for all *.pocketedge.in hosts. */
export const POCKETEDGE_COOKIE_DOMAIN = '.pocketedge.in';
