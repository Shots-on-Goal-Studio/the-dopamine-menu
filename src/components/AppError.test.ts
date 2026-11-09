import { describe, expect, it } from 'vitest'
import { errorMessage } from './AppError'

describe('unknown thrown values', () => {
  it('handles an undefined rejection without throwing a secondary error', () => {
    expect(errorMessage(undefined)).toBe('The menu could not load. Please try again.')
  })
  it('handles a null rejection without throwing a secondary error', () => {
    expect(errorMessage(null)).toBe('The menu could not load. Please try again.')
  })
  it('preserves useful error details', () => {
    expect(errorMessage(new Error('Network unavailable'))).toBe('Network unavailable')
  })
})