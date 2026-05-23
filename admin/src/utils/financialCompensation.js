/** Mirrors backend/services/financialCompensationService.js for UI display. */

export const normalizeFinancialCompensation = (input = {}) => {
  const source =
    typeof input === 'string'
      ? (() => {
          try {
            return JSON.parse(input)
          } catch {
            return {}
          }
        })()
      : input && typeof input === 'object'
        ? input
        : {}

  const raw = String(source.mode || '').toLowerCase()
  const mode = raw === 'fixed' ? 'fixed' : raw === 'hybrid' ? 'hybrid' : 'percentage'
  const percentage = Math.min(100, Math.max(0, Number.isFinite(Number(source.percentage)) ? Number(source.percentage) : 0))
  const fixedSalary = Math.max(0, Number.isFinite(Number(source.fixedSalary)) ? Number(source.fixedSalary) : 0)
  const percentageEnabled = Boolean(source.percentageEnabled) || percentage > 0

  return { mode, percentageEnabled, percentage, fixedSalary }
}

const fill = (t, key, vars = {}) => {
  if (typeof t !== 'function') {
    let s = key
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }
  let s = String(t(key))
  Object.entries(vars).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(String(v))
  })
  return s
}

const visitCountPhrase = (n, t) => {
  const v = Math.max(0, Math.floor(Number(n)))
  if (!Number.isFinite(v) || v <= 0) return ''
  return v === 1
    ? fill(t, ' across {{n}} paid patient visit', { n: v })
    : fill(t, ' across {{n}} paid patient visits', { n: v })
}

const paidVisitsNote = (paidVisitCount, t) => {
  const v = Math.max(0, Math.floor(Number(paidVisitCount)))
  if (!Number.isFinite(v) || v < 0) return ''
  if (v === 0) return ''
  return v === 1
    ? fill(t, ' (currently {{n}} paid visit)', { n: v })
    : fill(t, ' (currently {{n}} paid visits)', { n: v })
}

export const describeCompensationAttribution = (paidRevenue, compensation, options = {}) => {
  const c = normalizeFinancialCompensation(compensation)
  const revenue = Math.max(0, Number(paidRevenue || 0))
  const { paidVisitCount, t } = options
  const visitsOk = Number.isFinite(paidVisitCount) && paidVisitCount >= 0
  const visitSuffix = visitsOk ? visitCountPhrase(paidVisitCount, t) : ''
  const visitsNote = visitsOk ? paidVisitsNote(paidVisitCount, t) : ''

  const emptyHybrid = {
    label: fill(t, 'Hybrid compensation (not set)'),
    doctorAttributed: 0,
    clinicAttributed: revenue,
    isFixedMonthly: false,
    isHybrid: true,
    revenueSharePart: 0,
    fixedMonthlyPart: 0,
    percentageApplied: null,
    detail: fill(t, 'Set a revenue share % and/or a fixed monthly amount under Financial analytics → Pay doctor (hybrid).{{visitsNote}}', {
      visitsNote: visitsOk
        ? paidVisitCount === 1
          ? fill(t, ' Currently {{n}} paid visit in this view.', { n: paidVisitCount })
          : fill(t, ' Currently {{n}} paid visits in this view.', { n: paidVisitCount })
        : ''
    })
  }

  if (c.mode === 'fixed') {
    const amount = c.fixedSalary
    return {
      label: amount > 0 ? fill(t, 'Fixed monthly salary') : fill(t, 'Fixed salary (not set)'),
      doctorAttributed: amount,
      clinicAttributed: null,
      isFixedMonthly: true,
      isHybrid: false,
      revenueSharePart: 0,
      fixedMonthlyPart: amount,
      percentageApplied: null,
      detail:
        amount > 0
          ? fill(t, 'Monthly amount set by admin ({{amount}}). The doctor sees this fixed pay on their financial page; it is separate from per-visit revenue totals.', {
              amount: amount.toLocaleString()
            })
          : fill(t, 'Admin can set a fixed monthly amount under Financial analytics → Pay doctor, or in Doctors → Edit profile.')
    }
  }

  if (c.mode === 'hybrid') {
    const pctShare = c.percentage > 0 ? Math.round((revenue * c.percentage) / 100) : 0
    const fixAmt = c.fixedSalary > 0 ? c.fixedSalary : 0
    if (c.percentage <= 0 && fixAmt <= 0) {
      return emptyHybrid
    }
    const doctorAttributed = pctShare + fixAmt
    const labelParts = []
    if (c.percentage > 0) labelParts.push(fill(t, '{{pct}}% of paid visit revenue', { pct: c.percentage }))
    if (fixAmt > 0) labelParts.push(fill(t, '{{amount}}/month fixed', { amount: fixAmt.toLocaleString() }))
    const detailParts = []
    if (c.percentage > 0) {
      detailParts.push(
        fill(t, '{{pct}}% of paid visit revenue{{visitSuffix}} ≈ {{share}} from this view’s paid revenue.', {
          pct: c.percentage,
          visitSuffix,
          share: pctShare.toLocaleString()
        })
      )
    }
    if (fixAmt > 0) {
      detailParts.push(fill(t, 'Plus a fixed {{amount}} per month (guaranteed).', { amount: fixAmt.toLocaleString() }))
    }
    return {
      label: labelParts.join(' + ') || fill(t, 'Hybrid compensation'),
      doctorAttributed,
      clinicAttributed: Math.max(0, revenue - pctShare),
      isFixedMonthly: false,
      isHybrid: true,
      revenueSharePart: pctShare,
      fixedMonthlyPart: fixAmt,
      percentageApplied: c.percentage > 0 ? c.percentage : null,
      detail: detailParts.join(' ')
    }
  }

  if (c.percentage <= 0) {
    return {
      label: fill(t, 'Percentage not set'),
      doctorAttributed: 0,
      clinicAttributed: revenue,
      isFixedMonthly: false,
      isHybrid: false,
      revenueSharePart: 0,
      fixedMonthlyPart: 0,
      percentageApplied: null,
      detail: fill(t, 'Set a percentage (1–100) of revenue from paid patient visits{{visitsNote}} under Financial analytics → Pay doctor.', {
        visitsNote
      })
    }
  }

  const doctorAttributed = Math.round((revenue * c.percentage) / 100)
  return {
    label: fill(t, '{{pct}}% of paid visit revenue', { pct: c.percentage }),
    doctorAttributed,
    clinicAttributed: Math.max(0, revenue - doctorAttributed),
    isFixedMonthly: false,
    isHybrid: false,
    revenueSharePart: doctorAttributed,
    fixedMonthlyPart: 0,
    percentageApplied: c.percentage,
    detail: fill(
      t,
      'Admin assigned {{pct}}% of money collected from paid patient visits{{visitSuffix}}. Estimated share = {{pct}}% × paid revenue in this view.',
      { pct: c.percentage, visitSuffix }
    )
  }
}
