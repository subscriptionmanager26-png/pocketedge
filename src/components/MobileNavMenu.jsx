import React, { useEffect, useId } from 'react';
import { Menu, X } from 'lucide-react';

/** Sticky chrome height: banner (h-14 sm:h-16) + header (h-16 sm:h-[4.5rem]) */
const MENU_TOP = 'top-[calc(3.5rem+4rem)] sm:top-[calc(4rem+4.5rem)]';

export default function MobileNavMenu({ open, onOpen, onClose, children, label = 'Open menu' }) {
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div className="md:hidden shrink-0">
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-pe-text hover:bg-white/10 transition-colors"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close menu' : label}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            className={`fixed left-0 right-0 bottom-0 z-[55] bg-black/70 ${MENU_TOP}`}
            onClick={onClose}
            aria-label="Close menu"
          />
          <nav
            id={menuId}
            className={`fixed left-0 right-0 z-[60] ${MENU_TOP} border-b border-pe-border bg-pe-canvas shadow-xl`}
          >
            <div className="flex flex-col gap-1 px-5 py-4">{children}</div>
          </nav>
        </>
      )}
    </div>
  );
}
