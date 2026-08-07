import AppModalOverlay from './AppModalOverlay';

/**
 * In-app message dialog (replaces window.alert) — portaled so it covers Shell chrome.
 */
export default function AppMessageDialog({
  open = true,
  title = 'Something went wrong',
  message,
  confirmLabel = 'OK',
  onClose,
}) {
  if (!open || !message) return null;

  return (
    <AppModalOverlay open onClose={onClose} label={title} panelClassName="max-w-sm">
      <div className="px-4 py-5 md:px-5">
        <p className="text-[15px] font-semibold text-pe-text">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-pe-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-md bg-pe-accent px-4 text-sm font-bold text-white hover:bg-pe-accent-pressed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
