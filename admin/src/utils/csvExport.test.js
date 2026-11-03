import { describe, expect, it } from 'vitest'
import { csvFileName, toCsv } from './csvExport'

const columns = [
  { label: 'Name', value: (row) => row.name },
  { label: 'Amount', value: (row) => row.amount }
]

describe('toCsv', () => {
  it('writes a header and one line per row', () => {
    expect(toCsv(columns, [{ name: 'Ali', amount: 100 }])).toBe('Name,Amount\r\nAli,100')
  })

  it('quotes commas, quotes and line breaks', () => {
    expect(toCsv(columns.slice(0, 1), [{ name: 'A, "B"\nC' }])).toBe('Name\r\n"A, ""B""\nC"')
  })

  it('stops a spreadsheet running a value as a formula', () => {
    const csv = toCsv(columns.slice(0, 1), [{ name: '=HYPERLINK("x")' }, { name: '@cmd' }, { name: '+1' }, { name: '-1' }])
    expect(csv).toBe(`Name\r\n"'=HYPERLINK(""x"")"\r\n'@cmd\r\n'+1\r\n'-1`)
  })

  it('leaves real numbers alone, negative ones too', () => {
    expect(toCsv(columns.slice(1), [{ amount: -5 }])).toBe('Amount\r\n-5')
  })

  it('writes blank for missing values and keeps Arabic', () => {
    expect(toCsv(columns, [{ name: 'علي' }])).toBe('Name,Amount\r\nعلي,')
  })
})

describe('csvFileName', () => {
  it('dates the file', () => {
    expect(csvFileName('doctors', new Date(2026, 0, 5))).toBe('clinivo-doctors-2026-01-05.csv')
  })
})
