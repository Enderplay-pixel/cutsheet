import { describe, it, expect } from 'vitest'
import { calcSV, calcDailyFee, calcTotal, formatCents, calcBudgetVariance, calcCashflow } from '../utils/calculations'

describe('SV Calculation', () => {
  it('calculates SV contributions correctly for 10000 EUR', () => {
    const result = calcSV(1_000_000) // 10,000 EUR in cents
    expect(result.kv).toBe(73_000)
    expect(result.rv).toBe(93_000)
    expect(result.av).toBe(13_000)
    expect(result.total).toBe(result.kv + result.pv + result.rv + result.av)
    expect(result.net).toBe(1_000_000 - result.total)
  })

  it('returns zero for zero gross', () => {
    const result = calcSV(0)
    expect(result.total).toBe(0)
    expect(result.net).toBe(0)
  })

  it('net is always less than gross for positive gross', () => {
    const result = calcSV(50_000)
    expect(result.net).toBeLessThan(50_000)
    expect(result.net).toBeGreaterThan(0)
  })
})

describe('Daily Fee', () => {
  it('calculates total for multiple days', () => {
    expect(calcDailyFee(30_000, 5)).toBe(150_000)
  })
  it('returns 0 for 0 days', () => {
    expect(calcDailyFee(30_000, 0)).toBe(0)
  })
})

describe('Budget Total', () => {
  it('sums budget lines correctly', () => {
    const lines = [
      { quantity: 2, unit_price_cents: 10_000 },
      { quantity: 1.5, unit_price_cents: 20_000 },
    ]
    expect(calcTotal(lines)).toBe(50_000)
  })
  it('returns 0 for empty lines', () => {
    expect(calcTotal([])).toBe(0)
  })
})

describe('Format Cents', () => {
  it('formats EUR correctly', () => {
    const result = formatCents(1_050_00)
    expect(result).toContain('1.050')
    expect(result).toContain('€')
  })
  it('formats USD correctly', () => {
    const result = formatCents(9_99, 'USD')
    expect(result).toContain('$')
  })
})

describe('Budget Variance', () => {
  it('detects over budget', () => {
    const result = calcBudgetVariance(100_000, 120_000)
    expect(result.overBudget).toBe(true)
    expect(result.variance).toBe(20_000)
    expect(result.variancePercent).toBe(20)
  })
  it('detects under budget', () => {
    const result = calcBudgetVariance(100_000, 80_000)
    expect(result.overBudget).toBe(false)
    expect(result.variance).toBe(-20_000)
  })
  it('handles zero planned budget', () => {
    const result = calcBudgetVariance(0, 10_000)
    expect(result.variancePercent).toBe(0)
  })
})

describe('Cashflow', () => {
  it('calculates per-day correctly', () => {
    const lines = [{ total_cents: 100_000, category: 'Crew' }, { total_cents: 50_000, category: 'Equipment' }]
    const result = calcCashflow(lines, 5)
    expect(result.total).toBe(150_000)
    expect(result.perDay).toBe(30_000)
    expect(result.byCategory['Crew']).toBe(100_000)
  })
})
