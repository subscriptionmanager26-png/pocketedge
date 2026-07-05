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
    <div className="border-t border-pe-border px-4 py-3">
      <div className="flex gap-2.5">
        <Avatar person={CURRENT_USER} size="sm" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment… use $TICKER for disclosure"
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-pe-border bg-pe-surface px-3 py-2 text-[15px] text-pe-text outline-none focus:border-pe-accent focus:ring-1 focus:ring-pe-accent"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim()}
          className="rounded-md bg-pe-accent px-4 py-1.5 text-sm font-bold text-white hover:bg-pe-accent-pressed disabled:opacity-40"
        >
          Reply
        </button>
      </div>
    </div>
  );
}
