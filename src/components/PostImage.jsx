import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/** Closest supported frame for a photo's natural aspect ratio. */
export function classifyPostImageAspect(width, height) {
  if (!width || !height) return 'landscape';
  const ratio = width / height;
  const candidates = [
    { id: 'landscape', ratio: 16 / 9 },
    { id: 'square', ratio: 1 },
    { id: 'portrait', ratio: 9 / 16 },
  ];
  let best = candidates[0];
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = Math.abs(Math.log(ratio / candidate.ratio));
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best.id;
}

const FRAME_CLASS = {
  landscape: 'aspect-video w-full',
  square: 'aspect-square mx-auto w-full max-w-md',
  portrait: 'aspect-[9/16] mx-auto w-full max-h-[70vh] max-w-[280px]',
};

function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="Close image"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

/**
 * Post/feed image with auto 16:9, 1:1, or 9:16 framing.
 * Feed click opens the post; detail click opens a lightbox.
 */
export default function PostImage({
  src,
  isDetail = false,
  onOpenPost,
  className = '',
}) {
  const [aspect, setAspect] = useState('landscape');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!src) return null;

  const handleClick = (event) => {
    event.stopPropagation();
    if (isDetail) {
      setLightboxOpen(true);
      return;
    }
    onOpenPost?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`mt-3.5 block w-full overflow-hidden rounded-lg text-left ${
          isDetail || onOpenPost ? 'cursor-pointer' : ''
        } ${className}`}
        aria-label={isDetail ? 'View full image' : 'Open post'}
      >
        <img
          src={src}
          alt=""
          className={`${FRAME_CLASS[aspect] ?? FRAME_CLASS.landscape} object-cover`}
          loading="lazy"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            setAspect(classifyPostImageAspect(naturalWidth, naturalHeight));
          }}
        />
      </button>
      {lightboxOpen ? <ImageLightbox src={src} onClose={() => setLightboxOpen(false)} /> : null}
    </>
  );
}
