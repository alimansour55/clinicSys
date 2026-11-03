/* A spreadsheet runs a cell starting with one of these as a formula */
const FORMULA_START = /^[=+\-@\t\r]/

const toCell = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  const guarded = FORMULA_START.test(String(value)) ? `'${value}` : String(value)
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** `columns` is `[{ label, value: (row) => any }]`. Labels are already translated by the caller. */
export const toCsv = (columns, rows) => {
  const header = columns.map((column) => toCell(column.label)).join(',')
  const body = rows.map((row) => columns.map((column) => toCell(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

export const csvFileName = (name, now = new Date()) => {
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
  return `clinivo-${name}-${stamp}.csv`
}

/** Saves a CSV. The byte order mark is what makes Excel read Arabic correctly. */
export const downloadCsv = (name, columns, rows) => {
  const blob = new Blob([`\uFEFF${toCsv(columns, rows)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = csvFileName(name)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
