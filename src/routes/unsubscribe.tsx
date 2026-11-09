import { createFileRoute, Link } from '@tanstack/react-router'

// Compatibility for links in old emails; no tokens or send-gating state remain here.
export const Route = createFileRoute('/unsubscribe')({
  head: () => ({ meta: [
    { title: 'Email settings — Dopamine Menu' },
    { name: 'description', content: 'Find your current Dopamine Menu email settings.' },
    { property: 'og:title', content: 'Email settings — Dopamine Menu' },
    { property: 'og:description', content: 'Find your current Dopamine Menu email settings.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => (
    <div className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-display text-3xl">Email settings</h1>
      <p className="mt-6">This link is from an older email. Use the unsubscribe link in your latest email, or manage reminders in Account.</p>
      <Link to="/account" className="mt-8 inline-block font-body text-pink underline">Go to Account →</Link>
    </div>
  ),
})
