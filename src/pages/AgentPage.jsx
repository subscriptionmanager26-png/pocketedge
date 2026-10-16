import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import AgentBlocks from '../components/agent/AgentBlocks';
import GuestSignInCta from '../components/GuestSignInCta';
import { ensureSupabase, isSupabaseConfigured, signInWithGoogle } from '../lib/supabase';

async function authHeaders() {
  const supabase = await ensureSupabase();
  if (!supabase) throw new Error('not_configured');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_signed_in');
  return { Authorization: `Bearer ${token}` };
}

export default function AgentPage({ guestMode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [agentState, setAgentState] = useState('unknown');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = await ensureSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const ok = Boolean(data.session?.user);
    setSignedIn(ok);
    setReady(true);
    if (!ok) return;
    try {
      const headers = await authHeaders();
      const sync = await fetch('/api/agent/sync', { method: 'POST', headers, credentials: 'include' });
      const body = await sync.json();
      setAgentState(body.agent === 'active' ? 'active' : body.agent === 'disabled' ? 'disabled' : 'error');
      const list = await fetch('/api/agent/messages?limit=10', { headers, credentials: 'include' });
      if (list.ok) {
        const json = await list.json();
        setMessages(json.messages || []);
      }
    } catch {
      setAgentState('error');
    }
  }, []);

  useEffect(() => {
    if (guestMode || !isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    let unsubscribe = () => {};
    (async () => {
      const supabase = await ensureSupabase();
      if (!supabase || cancelled) return;
      await refreshSession();
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        refreshSession();
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [guestMode, refreshSession]);

  async function streamMessage(messageId, headers) {
    const res = await fetch(`/api/agent/messages/${messageId}/events`, { headers, credentials: 'include' });
    if (!res.ok || !res.body) throw new Error('stream_failed');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latest = null;
    const pullFull = async () => {
      const full = await fetch(`/api/agent/messages/${messageId}`, { headers, credentials: 'include' });
      if (full.ok) {
        const json = await full.json();
        latest = json.message;
        setLive(latest);
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine.slice(5).trim());
          if (data.type === 'block' || data.type === 'action_required' || data.type === 'status') {
            await pullFull();
          }
          if (data.type === 'done' || data.type === 'error') {
            await pullFull();
            if (latest) return latest;
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (latest) return latest;
    throw new Error('stream_empty');
  }

  async function onSend(value) {
    const q = (value ?? text).trim();
    if (!q || busy) return;
    setText('');
    setBusy(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/agent/messages', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: q, threadId: 'main' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || json?.error || 'Could not send message.');
        return;
      }
      const msg = json.message;
      setLive(msg);
      setMessages((m) => [msg, ...m]);
      const final = await streamMessage(msg.id, headers);
      setMessages((m) => m.map((x) => (x.id === final.id ? final : x)));
      setLive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (guestMode) {
    return (
      <GuestSignInCta
        variant="hero"
        title="Your private investing agent"
        description="Sign in with the same Google account you use on Pocketedge. Ask about markets, your portfolio, and ideas."
        action="use your agent"
        benefits={[
          'Answers grounded in your Pocketedge context',
          'Charts, tables, and clear summaries',
          'Not investment advice — your research copilot',
        ]}
      />
    );
  }

  if (!ready) {
    return <p className="px-4 py-12 text-center text-sm text-pe-text-secondary">Loading…</p>;
  }

  if (!isSupabaseConfigured()) {
    return (
      <p className="mx-4 my-12 rounded-xl border border-dashed border-pe-border px-6 py-12 text-center text-sm text-pe-text-secondary">
        Agent chat is not configured on this deployment yet.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <div className="mx-4 my-8 max-w-lg rounded-2xl border border-pe-border bg-white px-6 py-10 text-center">
        <p className="text-[17px] font-semibold text-pe-text">Sign in to continue</p>
        <p className="mt-2 text-sm text-pe-text-secondary">
          Use your Pocketedge Google account to open your personal agent.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex rounded-full bg-[var(--fv-accent,#ff6719)] px-6 py-2.5 text-sm font-medium text-white"
          onClick={() => signInWithGoogle({ afterAuthPath: '/ai' })}
        >
          Continue with Google
        </button>
      </div>
    );
  }

  if (agentState === 'disabled') {
    return (
      <div className="mx-4 my-8 max-w-lg rounded-2xl border border-pe-border bg-white px-6 py-10 text-center">
        <p className="text-[17px] font-semibold text-pe-text">Your agent is not enabled yet</p>
        <p className="mt-2 text-sm text-pe-text-secondary">
          Pocketedge turns this on from your account. Once enabled, refresh this page.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full border border-pe-border px-5 py-2 text-sm font-medium"
          onClick={() => refreshSession()}
        >
          Check again
        </button>
      </div>
    );
  }

  const show = live || messages[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[var(--fv-accent,#ff6719)]" />
        <h1 className="text-lg font-semibold text-pe-text">AI</h1>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {show ? (
        <article className="mb-8 rounded-2xl border border-pe-border bg-white p-5 sm:p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--fv-accent,#ff6719)]">
            Your question
          </p>
          <h2 className="mt-2 text-[1.05rem] font-semibold text-pe-text">{show.text}</h2>
          {show.status === 'working' ? (
            <p className="mt-3 text-sm text-pe-text-secondary">Working on your answer…</p>
          ) : null}
          {show.error ? <p className="mt-3 text-sm text-red-700">{show.error}</p> : null}
          <div className="mt-5">
            <AgentBlocks blocks={show.blocks} actions={show.actions} />
          </div>
        </article>
      ) : (
        <p className="mb-6 text-sm text-pe-text-secondary">
          Ask about rates, sectors, holdings, or anything on your mind.
        </p>
      )}

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || agentState !== 'active'}
          placeholder="Ask your agent…"
          className="h-11 flex-1 rounded-full border border-pe-border bg-white px-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--fv-accent,#ff6719)]/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || agentState !== 'active'}
          className="h-11 rounded-full bg-[var(--fv-accent,#ff6719)] px-6 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      <p className="mt-4 text-center text-[11px] text-pe-text-secondary">
        Not investment advice. Powered by your private Pocketedge agent.
      </p>
    </div>
  );
}
