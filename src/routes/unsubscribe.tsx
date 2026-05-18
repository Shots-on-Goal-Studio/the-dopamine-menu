import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: (search) =>
    z.object({ token: z.string().optional() }).parse(search),
  head: () => ({ meta: [{ title: 'Unsubscribe — Dopamine Menu' }] }),
  component: UnsubscribePage,
})

type State =
  | { kind: 'loading' }
  | { kind: 'valid' }
  | { kind: 'already' }
  | { kind: 'invalid' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' })
      return
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) return setState({ kind: 'invalid' })
        if (data.valid) return setState({ kind: 'valid' })
        if (data.reason === 'already_unsubscribed') return setState({ kind: 'already' })
        setState({ kind: 'invalid' })
      })
      .catch(() => setState({ kind: 'invalid' }))
  }, [token])

  const confirm = async () => {
    if (!token) return
    setState({ kind: 'loading' })
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) return setState({ kind: 'error', message: data.error ?? 'Failed' })
      if (data.success) return setState({ kind: 'success' })
      if (data.reason === 'already_unsubscribed') return setState({ kind: 'already' })
      setState({ kind: 'error', message: 'Unexpected response' })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pt-16 pb-20" style={{ fontFamily: 'var(--font-body)' }}>
      <h1 className="mb-8" style={{ fontFamily: 'var(--font-display)', fontSize: 40, textShadow: '5px 5px 0 var(--yellow)' }}>
        Unsubscribe
      </h1>

      <section className="p-7" style={{ border: '3px solid var(--ink)', background: 'var(--cream)' }}>
        {state.kind === 'loading' && <p>Checking your link…</p>}

        {state.kind === 'valid' && (
          <>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>
              Stop sending Dopamine Menu emails to this address?
            </p>
            <p className="mt-2 text-sm opacity-75">You can re-enable them any time from your Account settings.</p>
            <button
              onClick={confirm}
              className="mt-6 w-full px-4 py-3 text-xs uppercase"
              style={{ letterSpacing: '0.18em', background: 'var(--ink)', color: 'var(--yellow)', fontFamily: 'var(--font-display)' }}
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state.kind === 'success' && (
          <>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>You're unsubscribed.</p>
            <p className="mt-2 text-sm opacity-75">We won't email this address anymore.</p>
          </>
        )}

        {state.kind === 'already' && (
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>This address is already unsubscribed.</p>
        )}

        {state.kind === 'invalid' && (
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>This unsubscribe link is invalid or expired.</p>
        )}

        {state.kind === 'error' && (
          <p style={{ color: 'var(--pink)' }}>Something went wrong: {state.message}</p>
        )}
      </section>

      <Link to="/" className="mt-8 inline-block text-xs uppercase tracking-widest opacity-60 hover:opacity-100">
        ← Back to home
      </Link>
    </div>
  )
}
