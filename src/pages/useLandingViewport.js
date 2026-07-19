import { useEffect } from 'react';

const MOBILE_MEDIA = '(max-width: 1023px)';

function measureLandingInsets(root) {
  const vv = window.visualViewport;
  const nav = root.querySelector('.pe-landing-nav');
  const cta = root.querySelector('.pe-landing-cta-dock');
  const headline = root.querySelector('.pe-landing-headline');

  const navHeight = nav?.offsetHeight ?? 61;
  const ctaHeight = cta?.offsetHeight ?? 128;
  const headlineBlock = (headline?.offsetHeight ?? 120) + 36;
  const visibleHeight = vv?.height ?? window.innerHeight;

  let browserBottom = 0;
  if (vv) {
    browserBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }

  return { visibleHeight, browserBottom, navHeight, ctaHeight, headlineBlock };
}

function applyLandingViewport(root) {
  const { visibleHeight, browserBottom, navHeight, ctaHeight, headlineBlock } =
    measureLandingInsets(root);

  root.style.setProperty('--landing-visible-height', `${visibleHeight}px`);
  root.style.setProperty('--landing-browser-bottom', `${browserBottom}px`);
  root.style.setProperty('--landing-nav-height', `${navHeight}px`);
  root.style.setProperty('--landing-cta-height', `${ctaHeight}px`);
  root.style.setProperty('--landing-content-offset', `${headlineBlock}px`);

  const heroMin = Math.max(
    200,
    visibleHeight -
      navHeight -
      ctaHeight -
      headlineBlock -
      browserBottom -
      16
  );
  root.style.setProperty('--landing-hero-min', `${heroMin}px`);
}

/** Keeps the mobile landing CTA above browser chrome and the home indicator. */
export function useLandingViewport(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const media = window.matchMedia(MOBILE_MEDIA);
    let resizeObserver;

    const bind = () => {
      if (!media.matches) {
        root.style.removeProperty('--landing-visible-height');
        root.style.removeProperty('--landing-browser-bottom');
        root.style.removeProperty('--landing-nav-height');
        root.style.removeProperty('--landing-cta-height');
        root.style.removeProperty('--landing-content-offset');
        root.style.removeProperty('--landing-hero-min');
        return;
      }

      applyLandingViewport(root);

      const cta = root.querySelector('.pe-landing-cta-dock');
      const headline = root.querySelector('.pe-landing-headline');
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => applyLandingViewport(root));
      }
      if (cta) resizeObserver.observe(cta);
      if (headline) resizeObserver.observe(headline);
    };

    const onViewportChange = () => {
      window.requestAnimationFrame(bind);
    };

    bind();
    media.addEventListener('change', bind);

    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);

    return () => {
      media.removeEventListener('change', bind);
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      resizeObserver?.disconnect();
    };
  }, [rootRef]);
}
