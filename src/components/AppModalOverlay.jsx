import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * Full-viewport modal chrome via portal so the dim overlay covers Shell chrome
 * (top search, right rail, and mobile bottom nav) — same stacking as NewsSummarySheet.
 */
export default function AppModalOverlay({
  open = true,
  onClose,
  children,
  /** Extra classes on the panel (size/rounding overrides). */
  panelClassName = '',
  /** Close when backdrop is clicked (default true). */
  closeOnBackdrop = true,
  labelledBy,
  label,
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center bg-black/40 ${
        isDesktop ? 'items-center p-4' : 'items-end'
      }`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`w-full overflow-y-auto border border-pe-border bg-pe-canvas shadow-[0_12px_36px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] ${
          isDesktop
            ? 'max-h-[min(85vh,720px)] max-w-lg rounded-2xl'
            : 'max-h-[90dvh] rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]'
        } ${panelClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
