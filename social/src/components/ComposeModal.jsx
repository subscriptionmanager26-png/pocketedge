import { useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

export default function ComposeModal({ open, onClose, onPost }) {
  const [body, setBody] = useState('');

  if (!open) return null;

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    onPost?.(text);
    setBody('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-pe-border bg-pe-elevated sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-pe-border px-4 py-3">
          <button type="button" onClick={onClose} className="text-pe-text-muted hover:text-pe-text">
            <X className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">New post</span>
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim()}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
          >
            Post
          </button>
        </div>
        <div className="px-4 py-3">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a thesis… use $TICKER for disclosure"
            rows={6}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-pe-text outline-none placeholder:text-pe-text-muted"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-pe-text-muted">
            <button type="button" className="inline-flex items-center gap-1.5 hover:text-pe-text">
              <ImagePlus className="h-4 w-4" />
              Image
            </button>
            <span>Tickers auto-disclose your position</span>
          </div>
        </div>
      </div>
    </div>
  );
}
