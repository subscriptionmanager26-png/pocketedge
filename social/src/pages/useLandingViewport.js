import { useEffect } from 'react';

const MOBILE_MEDIA = '(max-width: 1023px)';

function measureLandingInsets(root) {
  const vv = window.visualViewport;
  const nav = root.querySelector('.navbar');
  const cta = root.querySelector('.mobile-cta-dock');

  const navHeight = nav?.offsetHeight ?? 61;
  const ctaHeight = cta?.offsetHeight ?? 128;
  const visibleHeight = vv?.height ?? window.innerHeight;

  let browserBottom = 0;
  if (vv) {
    browserBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }

  return { visibleHeight, browserBottom, navHeight, ctaHeight };
}

function applyLandingViewport(root) {
  const { visibleHeight, browserBottom, navHeight, ctaHeight } = measureLandingInsets(root);

  root.style.setProperty('--landing-visible-height', `${visibleHeight}px`);
  root.style.setProperty('--landing-browser-bottom', `${browserBottom}px`);
  root.style.setProperty('--landing-nav-height', `${navHeight}px`);
  root.style.setProperty('--landing-cta-height', `${ctaHeight}px`);
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
        return;
      }

      applyLandingViewport(root);

      const cta = root.querySelector('.mobile-cta-dock');
      if (cta && !resizeObserver) {
        resizeObserver = new ResizeObserver(() => applyLandingViewport(root));
        resizeObserver.observe(cta);
      }
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
