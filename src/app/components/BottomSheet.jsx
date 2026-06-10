import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl bg-[#F7F7F5] shadow-2xl flex flex-col animate-[slideUp_220ms_ease-out]"
      >
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 shrink-0">
          <h2 className="text-base font-semibold text-pe-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-pe-border/80 text-pe-text-muted"
            aria-label="Close panel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
