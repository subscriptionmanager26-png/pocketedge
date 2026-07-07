import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

export default function ComposeModal({ open, onClose, onPost }) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setBody('');
    setImage(null);
  };

  const submit = () => {
    const text = body.trim();
    if (!text && !image) return;
    onPost?.({ body: text, image });
    reset();
    onClose();
  };

  const onPickImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-pe-border bg-pe-canvas sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-pe-border px-4 py-3.5">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-md p-1 text-pe-text-secondary hover:bg-pe-surface hover:text-pe-text"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-[15px] font-semibold text-pe-text">New post</span>
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim() && !image}
            className="rounded-md bg-pe-accent px-4 py-1.5 text-sm font-bold text-white transition hover:bg-pe-accent-pressed disabled:opacity-40"
          >
            Post
          </button>
        </div>
        <div className="px-4 py-4">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a thesis… use @TICKER for disclosure"
            rows={6}
            className="w-full resize-none bg-transparent font-serif text-[17px] leading-[1.65] text-pe-ink outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-pe-text-muted"
          />
          {image && (
            <div className="relative mt-3 overflow-hidden rounded-lg">
              <img src={image} alt="" className="aspect-[16/10] w-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-pe-text-secondary">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 hover:text-pe-text"
            >
              <ImagePlus className="h-4 w-4" />
              Image
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            <span className="text-xs">Tickers auto-disclose your position</span>
          </div>
        </div>
      </div>
    </div>
  );
}
