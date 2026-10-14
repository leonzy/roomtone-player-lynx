import { expect, test } from 'vitest'
import { coerceHomeConfig, DEFAULT_HOME_CONFIG, homeGridColumns, homeItemLimit } from '../domain/home-layout.js'

test('defaults, malformed preferences and row count zero have distinct meanings', () => {
  expect(coerceHomeConfig(undefined)).toEqual(DEFAULT_HOME_CONFIG)
  expect(coerceHomeConfig({ layout: 'bad', columns: 9, rows: -1 })).toEqual(DEFAULT_HOME_CONFIG)
  expect(coerceHomeConfig({ layout: 'grid', columns: 6, rows: 0, showRadios: true })).toEqual({ layout: 'grid', columns: 6, rows: 0, showRadios: true })
})

test('six columns reduce to two on a phone, and the row budget uses those two', () => {
  const columns = homeGridColumns(390, 6, 2)
  expect(columns).toBe(2)
  expect(homeItemLimit({ layout: 'grid', columns: 6, rows: 3, showRadios: true }, columns, false)).toBe(6)
  expect(homeGridColumns(1180, 6, 4)).toBe(6)
  expect(homeItemLimit({ layout: 'list', columns: 0, rows: 2, showRadios: true }, columns, false)).toBe(200)
})
