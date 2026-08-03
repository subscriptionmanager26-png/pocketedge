import { useState } from 'react';
import Avatar from './Avatar';
import { CURRENT_USER } from '../data/mockData';

export default function CommentComposer({ onSubmit }) {
  const [body, setBody] = useState('');

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    onSubmit?.(text);
    setBody('');
  };

  return (
    <div className="border-t border-[var(--fv-border,#ececec)] px-4 py-4 md:mx-6 md:mb-6 md:rounded-[20px] md:border-0 md:bg-white md:px-6 md:shadow-[0_6px_24px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex gap-2.5">
        <Avatar person={CURRENT_USER} size="sm" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment… use @TICKER for disclosure"
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-[14px] border border-[var(--fv-border,#ececec)] bg-white px-3 py-2 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim()}
          className="rounded-[14px] bg-pe-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
        >
          Reply
        </button>
      </div>
    </div>
  );
}
