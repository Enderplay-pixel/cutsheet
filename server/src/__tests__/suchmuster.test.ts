import { describe, it, expect } from 'vitest'
import { enthaeltMuster } from '../lib/suchmuster'

describe('enthaeltMuster', () => {
  it('nimmt Platzhalter und Fluchtzeichen wörtlich', () => {
    expect(enthaeltMuster('Jana')).toBe('%Jana%')
    expect(enthaeltMuster('_')).toBe('%\\_%')
    expect(enthaeltMuster('100%')).toBe('%100\\%%')
    expect(enthaeltMuster('a\\b')).toBe('%a\\\\b%')
    expect(enthaeltMuster(undefined)).toBe('%%')
  })
})
