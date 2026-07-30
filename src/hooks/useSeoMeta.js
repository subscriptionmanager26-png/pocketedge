import { useEffect } from 'react';
import { setSeoMeta } from '../lib/seoMeta';

/**
 * Keep document title / description / canonical in sync with the route.
 * Pass null/undefined to skip (e.g. authenticated app shell that should not own SEO).
 */
export function useSeoMeta(options) {
  const enabled = Boolean(options);
  const title = options?.title;
  const description = options?.description;
  const path = options?.path;
  const image = options?.image;
  const noindex = options?.noindex;

  useEffect(() => {
    if (!enabled) return undefined;
    return setSeoMeta({ title, description, path, image, noindex });
  }, [enabled, title, description, path, image, noindex]);
}
