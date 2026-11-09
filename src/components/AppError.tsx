import { Button } from '@/components/ui/button'

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'The menu could not load. Please try again.'
}

export function AppError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display">Something broke</h1>
        <p className="mt-2 text-sm">{errorMessage(error)}</p>
        <Button onClick={onRetry} className="mt-6 bg-ink text-yellow font-display">Try again</Button>
      </div>
    </div>
  )
}